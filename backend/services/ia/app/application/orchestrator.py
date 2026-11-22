"""
Orchestrateur IA — Architecture NLU (Natural Language Understanding).
1. Le LLM reformule la demande en JSON (Intention).
2. Le Système (Python) traite la demande selon l'intention.
3. Le LLM reformule la réponse finale.
"""

from __future__ import annotations

import json
import time
from typing import Any, Optional
from uuid import uuid4

from app.core.config import get_settings
from app.domain.models import ChatContext, ChatResponse, SourceDocument, ToolCallResult, ProductCard
from app.infrastructure.llm import get_llm_client
from app.infrastructure.rag import get_rag_pipeline
from app.infrastructure.tools import get_tool_registry

SYSTEM_NLU_PROMPT = """Tu es un analyseur de requêtes (NLU) pour L'AMI, une boutique informatique.
Ton rôle est de transformer la demande du client en un objet JSON STRICT.
Tu ne dois PAS répondre au client, tu dois juste sortir du JSON.

Intentions possibles :
- "ticket" : Le client veut parler à un humain, ouvrir un ticket, ou contacter le SAV.
- "diagnostic" : Le client a un problème technique (panne, écran bleu, surchauffe, etc.).
- "produit" : Le client cherche un produit précis (ex: "je cherche une RTX 3060").
- "configuration" : Le client veut un PC complet selon un budget (ex: "je veux un PC pour 2 millions").
- "salutation" : Le client dit bonjour, merci, ou discute de manière générale.

Format de sortie STRICT (aucun autre texte) :
{
  "intent": "ticket|diagnostic|produit|configuration|salutation",
  "query": "Le texte de recherche ou le problème reformulé",
  "budget": 2000000 (uniquement si intent=configuration, sinon null),
  "usage": "gaming|bureautique" (uniquement si intent=configuration, sinon null)
}
"""

SYSTEM_NLG_PROMPT = """Tu es l'assistant commercial et technique de L'AMI à Madagascar.
Le système vient de traiter la demande du client et t'a fourni les résultats bruts.
Ta mission est de reformuler ces résultats en une réponse claire, polie et professionnelle en français.

RÈGLES STRICTES DE FILTRAGE :
1. Lis attentivement la question du client.
2. Ne garde QUE les informations des documents qui répondent directement à cette question.
3. Si le client parle d'un écran bleu, ignore les informations sur la politique de retour ou le GPU.
4. Sois concis. Ne recopie pas les documents mot pour mot. Fais des phrases.
"""

class AgentOrchestrator:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.llm = get_llm_client()
        self.tools = get_tool_registry()

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

        # =========================================================
        # 1. NLU : Le LLM reformule la demande en JSON
        # =========================================================
        nlu_prompt = f"Historique récent :\n{history or 'Aucun'}\n\nNouvelle demande : {message}"
        
        nlu_response = await self.llm.generate(prompt=nlu_prompt, system=SYSTEM_NLU_PROMPT)
        raw_content = nlu_response.get("content", "{}")
        
        # Nettoyage du JSON (au cas où le LLM ajoute des backticks)
        raw_content = raw_content.replace("```json", "").replace("```", "").strip()
        
        try:
            parsed = json.loads(raw_content)
            intent = parsed.get("intent", "salutation")
            query = parsed.get("query", message)
        except Exception as e:
            print(f"[NLU ERROR] Impossible de parser le JSON : {raw_content}")
            intent = "salutation"
            query = message

        print(f"[ROUTING] Intention détectée : {intent} | Requête : {query}")

        # =========================================================
        # 2. SYSTEME : Traitement selon l'intention
        # =========================================================
        sources: list[SourceDocument] = []
        tool_results: list[ToolCallResult] = []
        products: list[ProductCard] = []
        raw_system_result = ""

        # --- A. TICKET ---
        if intent == "ticket":
            if not auth_token:
                raw_system_result = "Erreur: L'utilisateur n'est pas connecté. Il doit se connecter pour créer un ticket."
            else:
                desc = f"Problème : {query}\nContexte : {history or 'Aucun'}"
                tc = await self.tools.execute(
                    "create_support_ticket",
                    {"title": "Demande de support", "description": desc, "priority": "medium"},
                    auth_token=auth_token, user_id=user_id
                )
                tool_results.append(tc)
                if isinstance(tc.result, dict) and tc.result.get("error"):
                    raw_system_result = f"Erreur de création du ticket : {tc.result['error']}"
                else:
                    tid = tc.result.get("ticket", {}).get("id", "N/A")
                    raw_system_result = f"Le ticket a été créé avec succès. Numéro : {tid}."

        # --- B. DIAGNOSTIC (RAG) ---
        elif intent == "diagnostic":
            rag = await get_rag_pipeline()
            sources = await rag.retrieve(query)
            if sources:
                context_str = "\n".join([f"- {s.title} : {s.content[:300]}" for s in sources])
                raw_system_result = f"Voici les documents techniques trouvés :\n{context_str}"
            else:
                raw_system_result = (
                    "Aucun document spécifique trouvé. Procédure générale : "
                    "1. Noter le code d'arrêt. 2. Démarrer en mode sans échec. "
                    "3. Tester la RAM. 4. Mettre à jour les pilotes."
                )

        # --- C. CONFIGURATION PC ---
        elif intent == "configuration":
            budget = parsed.get("budget") or 1000000
            usage = parsed.get("usage") or "gaming"
            tc = await self.tools.execute("suggest_pc_build", {"usage": usage, "budget": budget}, auth_token=auth_token)
            tool_results.append(tc)
            if isinstance(tc.result, dict) and tc.result.get("build"):
                raw_system_result = f"Configuration {usage} proposée : {json.dumps(tc.result['build'], ensure_ascii=False)}. Total : {tc.result.get('total')} Ar."
            else:
                raw_system_result = "Impossible de générer une configuration pour ce budget."

        # --- D. PRODUIT ---
        elif intent == "produit":
            tc = await self.tools.execute("search_products", {"search": query, "limit": 3}, auth_token=auth_token)
            tool_results.append(tc)
            products = self.tools.extract_products(tool_results)
            if products:
                raw_system_result = f"Produits trouvés : {json.dumps([p.model_dump() for p in products], ensure_ascii=False)}"
            else:
                raw_system_result = "Aucun produit trouvé dans le catalogue."

        # --- E. SALUTATION / GENERAL ---
        else:
            raw_system_result = "L'utilisateur te salue ou fait une discussion générale. Réponds poliment et demande comment tu peux l'aider."

        # =========================================================
        # 3. NLG : Le LLM reformule la réponse finale
        # =========================================================
        nlg_prompt = (
            f"Question du client : {message}\n\n"
            f"Documents et résultats récupérés :\n{raw_system_result}\n\n"
            "Rédige une réponse ciblée en gardant uniquement ce qui concerne la question du client."
        )
        final_response = await self.llm.generate(prompt=nlg_prompt, system=SYSTEM_NLG_PROMPT)
        final_reply = final_response.get("content", "")

        # ✅ FALLBACK : Si le LLM a échoué, on formate les données brutes proprement
        if "service de langage est momentanément indisponible" in final_reply or not final_reply:
            print("[FALLBACK] Le LLM a échoué, utilisation de la réponse système brute.")
            
            if intent == "produit" and products:
                # On formate nous-mêmes la liste des produits
                lines = ["Voici les produits trouvés :"]
                for p in products:
                    lines.append(f"- **{p.name}** : {float(p.price):,.0f} Ar".replace(",", " "))
                final_reply = "\n".join(lines)
                
            elif intent == "configuration":
                final_reply = f"Voici une configuration {parsed.get('usage')} pour un budget de {parsed.get('budget', 0):,.0f} Ar. Dites 'oui' si elle vous convient.".replace(",", " ")
                
            elif intent == "diagnostic" and sources:
                final_reply = f"Concernant votre problème, voici ce que j'ai trouvé :\n\n{sources[0].content[:500]}..."
                
            else:
                final_reply = raw_system_result

        cart_added = sum(int(tc.result.get("count") or 0) for tc in tool_results if tc.name == "add_to_cart" and isinstance(tc.result, dict))
        latency = int((time.perf_counter() - t0) * 1000)

        return ChatResponse(
            conversation_id=conv_id,
            reply=final_reply,
            mode=intent,
            sources=sources,
            tool_calls=tool_results,
            products=products,
            cart_added=cart_added,
            latency_ms=latency,
        )

_orchestrator: Optional[AgentOrchestrator] = None

def get_orchestrator() -> AgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator
