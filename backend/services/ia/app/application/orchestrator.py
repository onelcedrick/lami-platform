"""
Orchestrateur IA — pipeline NLU -> Systeme -> NLG.

1. NLU  : le LLM produit un JSON strict (intent, keywords, category, budget).
2. SYSTEME : routage deterministe vers RAG / outils / guardrails.
3. NLG  : reformulation francaise, avec historique conversationnel.

`mode` reste dans {support, commerce, general} (contrat frontend + golden set),
`intent` expose l'intention fine.
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Optional
from uuid import uuid4

from app.application.nlu import analyze as analyze_nlu
from app.application.session_store import get_session_store
from app.core.config import get_settings
from app.domain.models import (
    ChatContext, ChatResponse, ProductCard, SourceDocument, ToolCallResult,
)
from app.infrastructure.llm import get_llm_client
from app.infrastructure.rag import get_rag_pipeline
from app.infrastructure.tools import get_tool_registry

logger = logging.getLogger("ia.orchestrator")

INTENTS = ("ticket", "diagnostic", "produit", "configuration",
           "categories", "hors_sujet", "salutation")

INTENT_TO_MODE = {
    "ticket": "support", "diagnostic": "support",
    "produit": "commerce", "configuration": "commerce", "categories": "commerce",
    "salutation": "general", "hors_sujet": "general",
}

SYSTEM_NLU_PROMPT = """Tu es un analyseur de requetes (NLU) pour L'AMI, boutique informatique a Madagascar.
Tu transformes la demande du client en UN objet JSON STRICT. Tu ne reponds JAMAIS au client.

Intentions :
- "ticket"        : veut un humain, ouvrir un ticket, contacter le SAV
- "diagnostic"    : probleme technique (panne, ecran bleu, surchauffe, SSD non detecte...)
- "produit"       : cherche un ou des produits, un prix, une disponibilite
- "configuration" : veut un PC complet pour un budget donne
- "categories"    : demande les rayons / types de materiels vendus
- "hors_sujet"    : recette, meteo, politique, sante, juridique, blague, poeme, piratage, traduction
- "salutation"    : bonjour, merci, presentation, question sur l'assistant

Regles CRITIQUES pour "keywords" :
- 1 a 4 mots-cles techniques SEPARES PAR DES ESPACES, jamais une phrase.
- Garde uniquement marques / modeles / specs presentes dans un nom de produit.
- Supprime "je cherche", "compatible", "budget", "ariary", les montants.
- Exemples :
  "je cherche un ram 32GB"                        -> keywords "32GB DDR5"
  "je cherche une carte mere compatible RTX 4070"  -> keywords "B650 X670"
  "je cherch un rtx 4070"                          -> keywords "RTX 4070"
  "un gpu de 3M ariary"                            -> keywords "RTX"
  "vous avez des SSD Samsung ?"                    -> keywords "Samsung 990"

Categories valides : CPU, GPU, RAM, Stockage, Carte mere, Alimentation, Boitier,
Refroidissement, Peripheriques, PC Complets, Imprimante, Moniteur, Ecrans,
Claviers, Souris, Audio, Logiciels, Reseau, Ondulaire, Pate thermique.

Sortie JSON EXACTE :
{"intent":"...","keywords":"...","category":"... ou null","query":"reformulation courte du besoin en francais","budget":null,"usage":null,"max_price":null}
- budget : nombre en Ariary, uniquement si intent=configuration (ex: "3 millions" -> 3000000)
- usage  : gaming | bureautique | creation | streaming, uniquement si configuration
- max_price : nombre en Ariary si le client donne un plafond pour un produit, sinon null
"""

SYSTEM_NLG_PROMPT = """Tu es l'assistant commercial et technique de L'AMI (Madagascar).
Le systeme a deja traite la demande et te fournit les resultats bruts.
Reformule-les en francais clair, poli et concis (2 a 6 phrases).

REGLES ABSOLUES :
1. N'invente JAMAIS un prix, un stock, une note ou une reference : utilise uniquement les donnees fournies.
2. Si le resultat indique AUCUN produit, dis clairement que ce produit n'est pas dans notre catalogue. N'invente rien.
3. Ne construis JAMAIS d'URL ni de lien : le champ image n'est pas une page produit.
4. Ne garde que ce qui repond a la question du client.
5. Utilise l'historique pour comprendre les questions de suivi ("et en 32 Go ?", "vous en avez combien ?").
6. Prix en Ariary, groupes par espaces (ex: 1 336 500 Ar).
7. Tu ne traites que le materiel informatique, le support technique et le catalogue L'AMI.
8. Un "budget maximum" est un PLAFOND, jamais un prix cible. Si des produits sont
   fournis sous ce plafond, presente-les comme des options DANS le budget du client.
   N'ecris JAMAIS "aucun produit a X Ar" quand des produits moins chers sont proposes.
9. N'affirme JAMAIS une compatibilite technique non verifiee. Pour une carte mere,
   precise que le choix depend du processeur (socket AM4/AM5/LGA) et du type de
   RAM (DDR4 ou DDR5). Une RTX se branche sur tout slot PCIe x16.
10. Ecris en francais avec les accents corrects (é, è, à, ç, ô).
"""

REFUSAL = (
    "Je suis l'assistant L'AMI, spécialisé dans le matériel informatique et le "
    "support technique. Je ne peux pas répondre à cette demande. "
    "Je peux vous aider à choisir des composants, configurer un PC selon votre "
    "budget, ou diagnostiquer une panne."
)

OFFTOPIC_PATTERNS = [
    r"\brecette\b", r"\bgateau\b", r"\bcuisin", r"\bcoupe du monde\b",
    r"\bmedicament\b", r"\bmal a la tete\b", r"\bdoliprane\b", r"\bdivorc",
    r"\bblague\b", r"\bpoeme\b", r"\bmeteo\b", r"\btradui",
    r"\bpresident\b", r"\bcannabis\b", r"\bpirater\b", r"\bhack",
    r"\bvoler des mots de passe\b", r"\bcontrole parental\b", r"\bpoesie\b",
]

COMMERCE_POLICY = [
    "politique de retour", "politique de garantie", "politique de remboursement",
    "politique de livraison", "politique de confidentialite", "politique sav",
    "politique de prix", "politique commerciale", "conditions de retour",
]

SUPPORT_HINTS = [
    "panne", "erreur", "ecran bleu", "bsod", "ne demarre", "ne s'allume",
    "surchauffe", "driver", "pilote", "bios", "probleme", "bug", "diagnostic",
    "reparer", "installer", "pas de signal", "cmos", "nvme non", "n'apparait pas",
    "garantie", "retour", "sav", "temperature", "chauffe", "plante", "crash",
    "ddr4", "ddr5 sur", "xmp", "expo", "alimentation pour", "wattage",
]
BUILD_HINTS = ["config", "configure", "pc pour", "pc gaming", "pc bureautique",
               "montage", "build", "machine pour", "pc complet", "un pc"]
CATEGORY_HINTS = ["categories", "categorie", "rayons", "rayon",
                  "type de materiel", "types de produits", "que vendez"]
TICKET_HINTS = ["ticket", "sav", "technicien", "parler a un humain", "reclamation"]


def _strip_accents(s: str) -> str:
    import unicodedata
    s = (s or "").lower()
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


def extract_budget(message: str) -> Optional[float]:
    low = _strip_accents(message)
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(m\b|million|millions|kk)", low)
    if m:
        return float(m.group(1).replace(",", ".")) * 1_000_000
    m = re.search(r"(\d[\d\s.]{4,})\s*(ar|ariary|mga)?", low)
    if m:
        digits = re.sub(r"\D", "", m.group(1))
        if digits:
            val = float(digits)
            if val >= 100_000:
                return val
    return None


def extract_usage(message: str) -> str:
    low = _strip_accents(message)
    if any(w in low for w in ("montage", "video", "creation", "contenu", "3d", "render")):
        return "creation"
    if any(w in low for w in ("stream", "twitch", "diffusion")):
        return "streaming"
    if any(w in low for w in ("bureautique", "bureau", "teletravail", "maison", "etudiant")):
        return "bureautique"
    return "gaming"


def fallback_intent(message: str) -> str:
    low = _strip_accents(message)
    if any(re.search(p, low) for p in OFFTOPIC_PATTERNS):
        return "hors_sujet"
    if any(h in low for h in CATEGORY_HINTS):
        return "categories"
    if any(h in low for h in TICKET_HINTS):
        return "ticket"
    if extract_budget(message) and any(h in low for h in BUILD_HINTS):
        return "configuration"
    if any(h in low for h in SUPPORT_HINTS):
        return "diagnostic"
    if any(h in low for h in BUILD_HINTS):
        return "configuration"
    if any(w in low for w in ("cherche", "prix", "cout", "stock", "achet", "gpu",
                              "cpu", "ram", "ssd", "rtx", "ryzen", "carte",
                              "ecran", "clavier", "souris", "imprimante", "pc")):
        return "produit"
    return "salutation"


def parse_nlu(raw: str, message: str) -> dict:
    txt = re.sub(r"```(?:json)?|```", "", raw or "").strip()
    obj: Any = None
    try:
        obj = json.loads(txt)
    except Exception:
        m = re.search(r"\{.*\}", txt, re.S)
        if m:
            try:
                obj = json.loads(m.group(0))
            except Exception:
                obj = None
    if not isinstance(obj, dict):
        obj = {}

    intent = obj.get("intent")
    if intent not in INTENTS:
        intent = fallback_intent(message)

    keywords = str(obj.get("keywords") or "").strip()
    if not keywords:
        keywords = re.sub(
            r"\b(je|cherche|cherch|veux|un|une|des|de|pour|avec|compatible|"
            r"budget|ariary|ar|prix|montre|montrez|vous|avez|svp)\b", " ",
            message, flags=re.I,
        )
        keywords = " ".join(keywords.split())[:60]

    def _num(v):
        try:
            f = float(v)
            return f if f > 0 else None
        except (TypeError, ValueError):
            return None

    return {
        "intent": intent,
        "keywords": keywords,
        "category": obj.get("category") if isinstance(obj.get("category"), str) else None,
        "query": str(obj.get("query") or message).strip(),
        "budget": _num(obj.get("budget")),
        "usage": obj.get("usage") if isinstance(obj.get("usage"), str) else None,
        "max_price": _num(obj.get("max_price")),
    }


class AgentOrchestrator:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.llm = get_llm_client()
        self.tools = get_tool_registry()
        self.sessions = get_session_store()

    async def handle(
        self,
        message: str,
        mode: str = "auto",
        conversation_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
        context: Optional[ChatContext] = None,
        history: Optional[str] = None,
    ) -> ChatResponse:
        t0 = time.perf_counter()
        conv_id = conversation_id or str(uuid4())
        hist = history or ""

        sources: list[SourceDocument] = []
        tool_results: list[ToolCallResult] = []
        products: list[ProductCard] = []
        raw = ""
        intent = ""
        parsed: dict = {}

        session = self.sessions.get(conv_id)

        # ---------- 0. Guardrails deterministes ----------
        low = _strip_accents(message)
        is_policy = any(w in low for w in COMMERCE_POLICY)
        if not is_policy and any(re.search(p, low) for p in OFFTOPIC_PATTERNS):
            return self._respond(conv_id, REFUSAL, "hors_sujet", t0)

        # ---------- 0bis. Confirmation panier (EF-05 / EF-06) ----------
        pending = session.get("pending_build") or []
        if pending:
            yes = any(w in low for w in ("oui", "ok", "daccord", "d'accord",
                                         "valide", "ajoute", "panier", "yes", "go"))
            no = any(w in low for w in ("non", "annule", "pas maintenant", "refuse"))
            if yes and len(low) < 90:
                items = [{
                    "product_id": str(p.get("id") or ""),
                    "name": p.get("name") or "",
                    "price": float(p.get("price") or 0),
                    "quantity": 1,
                    "image": (p.get("images") or [None])[0]
                        if isinstance(p.get("images"), list) else p.get("image"),
                    "stock": p.get("stock"),
                    "brand": p.get("brand"),
                    "slug": p.get("slug"),
                } for p in pending]
                tc = await self.tools.execute("add_to_cart", {"items": items},
                                              auth_token=auth_token, user_id=user_id)
                tool_results.append(tc)
                self.sessions.clear_key(conv_id, "pending_build")
                n = tc.result.get("count", 0) if isinstance(tc.result, dict) else 0
                reply = (f"C'est noté : {n} article(s) préparé(s) pour votre panier. "
                         "Ouvrez le panier pour finaliser la commande.") if n else \
                        "Je n'ai pas pu préparer le panier. Reformulez votre configuration."
                return self._respond(conv_id, reply, "configuration", t0,
                                     tool_results=tool_results,
                                     products=self.tools.extract_products(tool_results))
            if no:
                self.sessions.clear_key(conv_id, "pending_build")
                return self._respond(
                    conv_id,
                    "D'accord, je n'ajoute rien au panier. Donnez-moi un autre budget "
                    "ou un autre usage si vous souhaitez une nouvelle configuration.",
                    "configuration", t0)

        # ---------- 0ter. Contexte produit frontend (EF-04) ----------
        if context is not None and getattr(context, "product", None):
            tc = await self.tools.execute(
                "get_product", {"product_id": context.product.id},
                auth_token=auth_token, user_id=user_id)
            tool_results.append(tc)
            products = self.tools.extract_products(tool_results)
            data = tc.result if isinstance(tc.result, dict) else {}
            raw = f"Donnees du produit consulte : {json.dumps(data, ensure_ascii=False)[:1500]}"
            intent = "produit"
            reply = await self._nlg(message, raw, hist)
            return self._respond(conv_id, reply, intent, t0,
                                 tool_results=tool_results, products=products)

        # ---------- 1. NLU ----------
        # Fast-path : salutation evidente -> aucun appel NLU (1 seul appel LLM)
        stripped = low.strip(" !?.:,;")
        if len(stripped) <= 28 and stripped in (
            "bonjour", "salut", "bonsoir", "hello", "coucou", "hi", "hey",
            "merci", "merci beaucoup", "ok", "ca va", "qui es tu",
        ):
            parsed = {"intent": "salutation", "keywords": "", "category": None,
                      "query": message, "budget": None, "usage": None,
                      "max_price": None}
        else:
            parsed = await analyze_nlu(self.llm, self.settings, message, hist)
        intent = parsed["intent"]

        # Une question sur la garantie / le retour est une demande d'INFORMATION
        # (RAG), pas une ouverture de ticket.
        info_words = ("garantie", "retour", "remboursement", "politique")
        ticket_words = ("ouvrir un ticket", "creer un ticket", "parler a un humain",
                        "contacte", "technicien")
        if any(w in low for w in info_words) and not any(w in low for w in ticket_words):
            intent = "diagnostic"

        # Une question de PRIX sans montant est une recherche catalogue,
        # pas une demande de configuration.
        price_words = ("combien", "coute", "quel est le prix", "quel prix",
                       "tarif", "prix de", "prix du", "prix d")
        if any(w in low for w in price_words) and extract_budget(message) is None:
            intent = "produit"

        # Mode force par l'appelant
        if mode == "support" and intent not in ("ticket", "diagnostic"):
            intent = "diagnostic"
        elif mode == "commerce" and intent in ("salutation", "diagnostic"):
            intent = "configuration" if extract_budget(message) else "produit"
        elif mode == "general":
            intent = "salutation"

        logger.info("NLU intent=%s keywords=%r category=%s budget=%s",
                    intent, parsed["keywords"], parsed["category"], parsed["budget"])

        # ---------- 2. SYSTEME ----------
        if intent == "hors_sujet":
            return self._respond(conv_id, REFUSAL, "hors_sujet", t0)

        if intent == "ticket":
            if not auth_token:
                raw = ("L'utilisateur n'est pas connecte : la creation d'un ticket "
                       "necessite une connexion. Invite-le a se connecter.")
            else:
                tc = await self.tools.execute(
                    "create_support_ticket",
                    {"title": (parsed["query"] or message)[:80],
                     "description": f"{parsed['query'] or message}\n\nHistorique :\n{hist}",
                     "priority": "medium"},
                    auth_token=auth_token, user_id=user_id)
                tool_results.append(tc)
                res = tc.result if isinstance(tc.result, dict) else {}
                if res.get("error"):
                    raw = f"ECHEC de creation du ticket : {res['error']}. Explique et propose de reessayer."
                else:
                    ticket = res.get("ticket") or {}
                    tid = ticket.get("id") or ticket.get("_id") or "N/A"
                    raw = f"Ticket cree avec succes. Numero : {tid}."

        elif intent == "diagnostic":
            rag = await get_rag_pipeline()
            sources = await rag.retrieve(parsed["query"] or message)
            if not sources:
                sources = await rag.retrieve(message)
            if sources:
                raw = "Documents techniques pertinents :\n" + "\n".join(
                    f"- {s.title} : {s.content[:600]}" for s in sources)
            else:
                raw = ("Aucun document specifique trouve. Propose une procedure "
                       "generale prudente et suggere d'ouvrir un ticket support.")

        elif intent == "categories":
            tc = await self.tools.execute("list_categories", {}, auth_token=auth_token)
            tool_results.append(tc)
            res = tc.result if isinstance(tc.result, dict) else {}
            names = [c.get("name") for c in (res.get("categories") or [])
                     if isinstance(c, dict)]
            raw = f"Categories du catalogue L'AMI ({len(names)}) : {', '.join(names)}"

        elif intent == "configuration":
            budget = parsed["budget"] or extract_budget(message) or 0
            usage = parsed["usage"] or extract_usage(message)
            if budget <= 0:
                tc0 = await self.tools.execute(
                    "search_products",
                    {"search": "PC complet", "category": "PC Complets", "limit": 4},
                    auth_token=auth_token,
                )
                tool_results.append(tc0)
                products = self.tools.extract_products(tool_results)
                lines = "\n".join(
                    f"- {p.name} : {p.price:,.0f} Ar".replace(",", " ")
                    for p in products
                )
                raw = ("Le client veut une configuration mais n'a pas donne de budget. "
                       "Presente ces PC complets du catalogue comme point de depart, "
                       "puis demande le budget en Ariary et l'usage.\n" + lines)
            else:
                tc = await self.tools.execute(
                    "suggest_pc_build", {"usage": usage, "budget": budget},
                    auth_token=auth_token)
                tool_results.append(tc)
                products = self.tools.extract_products(tool_results)
                res = tc.result if isinstance(tc.result, dict) else {}
                build = res.get("build") or []
                if build:
                    self.sessions.update(conv_id, pending_build=build)
                    lines = [
                        f"- {p.get('category','?')} : {p.get('name')} — {float(p.get('price') or 0):,.0f} Ar"
                        .replace(",", " ")
                        for p in build
                    ]
                    raw = (
                        f"Configuration {usage} pour un budget de {budget:,.0f} Ar.\n"
                        + "\n".join(lines)
                        + f"\nTotal : {float(res.get('estimated_total') or 0):,.0f} Ar. "
                        f"Slots remplis : {res.get('slots_filled')}. "
                        f"Manquants : {res.get('missing_slots')}. "
                        "Propose au client de repondre OUI pour preparer l'ajout au panier."
                    ).replace(",", " ")
                else:
                    raw = (f"Aucune configuration possible sous {budget:,.0f} Ar. "
                           "Le budget est insuffisant pour les composants du catalogue. "
                           "Suggere un budget superieur.").replace(",", " ")

        elif intent == "produit":
            args: dict[str, Any] = {
                "search": parsed["keywords"] or message,
                "limit": 6,
            }
            if parsed["category"]:
                args["category"] = parsed["category"]
            budget = parsed["max_price"] or extract_budget(message)
            if budget:
                args["max_price"] = budget
            tc = await self.tools.execute("search_products", args, auth_token=auth_token)
            tool_results.append(tc)
            products = self.tools.extract_products(tool_results)
            if products:
                head = ""
                if budget:
                    head = (
                        f"BUDGET MAXIMUM du client : {budget:,.0f} Ar "
                        f"(PLAFOND, pas un prix cible). {len(products)} produit(s) "
                        "trouve(s) SOUS ce budget : presente-les comme des options "
                        "dans son budget.\n"
                    ).replace(",", " ")
                chip: dict = {}
                for tcx in tool_results:
                    if isinstance(tcx.result, dict):
                        for itx in (tcx.result.get("products") or []):
                            if isinstance(itx, dict):
                                ax = itx.get("attributes")
                                cx = ax.get("chipset") if isinstance(ax, dict) else None
                                if cx:
                                    chip[str(itx.get("id"))] = str(cx)
                raw = head + "Produits trouves dans le catalogue :\n" + "\n".join(
                    f"- {p.name} ({p.brand}) : {p.price:,.0f} Ar — stock {p.stock}"
                    .replace(",", " ")
                    + (f" — chipset {chip[p.id]}" if p.id in chip else "")
                    + (f" — note {p.rating}/5" if p.rating else "")
                    for p in products)
            else:
                # Reponse deterministe : zero risque d'hallucination
                reply = (
                    "Je ne peux pas vous proposer ce produit : il n'est pas dans "
                    "notre catalogue L'AMI. Nous vendons uniquement du matériel "
                    "informatique (processeurs, cartes graphiques, RAM, stockage, "
                    "cartes mères, alimentations, boîtiers, écrans, périphériques). "
                    "Précisez un composant et je relance la recherche."
                )
                return self._respond(conv_id, reply, intent, t0,
                                     tool_results=tool_results, products=products)

        else:  # salutation
            raw = ("Le client salue ou discute. Reponds brievement et propose ton aide "
                   "sur le catalogue, les configurations PC ou le support technique.")

        # ---------- 3. NLG ----------
        reply = await self._nlg(message, raw, hist)
        if not reply:
            reply = self._fallback_reply(intent, raw, products, sources, parsed)

        return self._respond(conv_id, reply, intent, t0, sources=sources,
                             tool_results=tool_results, products=products)

    # ------------------------------------------------------------
    async def _nlg(self, message: str, raw: str, hist: str) -> str:
        res = await self.llm.generate(
            prompt=(
                f"Historique de la conversation :\n{hist or 'Aucun'}\n\n"
                f"Question actuelle du client : {message}\n\n"
                f"Resultats du systeme :\n{raw}\n\n"
                "Redige la reponse finale en francais, ciblee et concise."
            ),
            system=SYSTEM_NLG_PROMPT,
            temperature=0.4,
            max_tokens=self.settings.nlg_max_tokens,
        )
        content = res.get("content", "")
        if res.get("error") or not content:
            return ""
        return content

    def _fallback_reply(self, intent: str, raw: str,
                        products: list[ProductCard],
                        sources: list[SourceDocument],
                        parsed: dict) -> str:
        """Reponse de secours quand le LLM (NLG) est indisponible.

        REGLE D'OR : ne JAMAIS renvoyer le prompt systeme brut au client.
        Chaque intention possede sa propre reformulation propre.
        """
        # Salutation / discussion generale : phrase accueillante
        if intent in ("salutation", "general"):
            return (
                "Bonjour ! Je suis l'assistant L'AMI. Je peux vous aider a choisir "
                "des composants, configurer un PC selon votre budget ou diagnostiquer "
                "une panne. Que recherchez-vous aujourd'hui ?"
            )
        # Commerce : liste structuree des produits trouves
        if intent == "produit" and products:
            lines = ["Voici les produits trouves dans le catalogue L'AMI :"]
            for p in products:
                lines.append(f"- **{p.name}** : {float(p.price):,.0f} Ar".replace(",", " "))
            return "\n".join(lines)
        # Configuration : recapitulatif du build + demande de confirmation
        if intent == "configuration" and products:
            usage = parsed.get("usage") or "gaming"
            lines = [f"Voici une configuration {usage} compatible :"]
            for p in products:
                lines.append(f"- {p.name} : {float(p.price):,.0f} Ar".replace(",", " "))
            lines.append("Repondez OUI pour preparer l'ajout au panier.")
            return "\n".join(lines)
        # Support : extrait du document RAG le plus pertinent
        if intent == "diagnostic" and sources:
            return f"Concernant votre probleme, voici la procedure L'AMI :\n{sources[0].content[:700]}"
        # Ticket : guidage connexion
        if intent == "ticket":
            return ("Je peux creer un ticket support pour vous. "
                    "Connectez-vous a votre compte puis reformulez votre demande.")
        # Categories : liste courte lisible
        if intent == "categories":
            return ("Nos rayons : CPU, GPU, RAM, Stockage, Carte mere, Alimentation, "
                    "Boitier, Refroidissement, Moniteur, Peripheriques, PC Complets.")
        # Dernier recours : redirection utile (jamais de texte interne)
        return ("Je suis l'assistant L'AMI, specialise dans le materiel informatique. "
                "Precisez votre besoin (produit, budget, panne) et je vous reponds.")

    def _respond(self, conv_id: str, reply: str, intent: str, t0: float,
                 sources: Optional[list[SourceDocument]] = None,
                 tool_results: Optional[list[ToolCallResult]] = None,
                 products: Optional[list[ProductCard]] = None) -> ChatResponse:
        tool_results = tool_results or []
        products = products if products is not None else self.tools.extract_products(tool_results)
        cart_added = sum(
            int(tc.result.get("count") or 0)
            for tc in tool_results
            if tc.name == "add_to_cart" and isinstance(tc.result, dict)
        )
        return ChatResponse(
            conversation_id=conv_id,
            reply=reply,
            mode=INTENT_TO_MODE.get(intent, "general"),
            intent=intent,
            sources=sources or [],
            tool_calls=tool_results,
            products=products,
            cart_added=cart_added,
            latency_ms=int((time.perf_counter() - t0) * 1000),
        )


_orchestrator: Optional[AgentOrchestrator] = None


def get_orchestrator() -> AgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator
