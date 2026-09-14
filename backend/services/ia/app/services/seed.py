"""Documents de connaissance initiaux pour le RAG (support technique PC)."""

from app.domain.models import KnowledgeDocument
from app.rag.vector_store import get_vector_store

SEED_DOCUMENTS = [
    KnowledgeDocument(
        title="Ecran bleu (BSOD) - Diagnostic de base",
        content=(
            "Un ecran bleu Windows (BSOD) indique une erreur systeme critique. "
            "Etapes de diagnostic : 1) Noter le code d'arret (ex: MEMORY_MANAGEMENT, "
            "IRQL_NOT_LESS_OR_EQUAL, DRIVER_IRQL). 2) Demarrer en mode sans echec. "
            "3) Mettre a jour les pilotes GPU et chipset. 4) Tester la RAM avec "
            "Windows Memory Diagnostic. 5) Verifier la temperature CPU/GPU. "
            "6) Desinstaller les derniers logiciels ou mises a jour. "
            "Si le BSOD survient au jeu uniquement, le GPU ou son alimentation "
            "est souvent en cause."
        ),
        category="diagnostic",
        tags=["bsod", "ecran bleu", "windows", "crash"],
        source="manual",
    ),
    KnowledgeDocument(
        title="PC ne demarre pas - Checklist alimentation",
        content=(
            "Si le PC ne s'allume pas : 1) Verifier que la prise et l'interrupteur "
            "du bloc d'alimentation (PSU) sont en position ON. 2) Tester avec un "
            "autre cable secteur. 3) Debrancher GPU, disques et peripherals, "
            "tester en configuration minimale (CPU + 1 barrette RAM). "
            "4) Verifier les connecteurs 24-pin carte mere et 8-pin CPU. "
            "5) Un PSU sous-dimensionne ou defaillant est une cause frequente. "
            "Puissance recommandee : RTX 4070 ~650W, RTX 4080 ~750W, "
            "RTX 4090 ~850W 80+ Gold."
        ),
        category="diagnostic",
        tags=["demarrage", "alimentation", "psu", "power"],
        source="manual",
    ),
    KnowledgeDocument(
        title="Pas de signal ecran - GPU et affichage",
        content=(
            "Pas d'image au demarrage : 1) Verifier le cable video (DisplayPort/HDMI) "
            "branche sur la carte graphique et non sur la carte mere si un GPU dedie "
            "est present. 2) Reseater le GPU dans son slot PCIe. 3) Tester avec un "
            "seul stick de RAM. 4) Clear CMOS (jumper ou retirer pile 5 min). "
            "5) Si iGPU disponible, tester la sortie carte mere. "
            "6) Bruit de bip au POST : consulter le manuel carte mere pour le code."
        ),
        category="diagnostic",
        tags=["affichage", "gpu", "signal", "ecran"],
        source="manual",
    ),
    KnowledgeDocument(
        title="Surchauffe CPU - Solutions",
        content=(
            "Temperatures CPU elevees (>90C en charge) : 1) Verifier que le "
            "ventirad/AIO est correctement monte et que la protection plastique "
            "a ete retiree. 2) Reappliquer de la pate thermique. "
            "3) Controler le flux d'air du boitier (intake avant, exhaust arriere/haut). "
            "4) Dans le BIOS : activer un profil de ventilateur plus agressif. "
            "5) Undervolt ou limiter le boost si necessaire. "
            "Temperatures cibles idle : 30-45C, charge : 70-85C selon le modele."
        ),
        category="refroidissement",
        tags=["surchauffe", "cpu", "temperature", "ventirad"],
        source="manual",
    ),
    KnowledgeDocument(
        title="Compatibilite RAM DDR4 vs DDR5",
        content=(
            "DDR4 et DDR5 ne sont pas interchangeables. "
            "La generation depend du socket et de la carte mere. "
            "AM5 (Ryzen 7000/9000) : DDR5 uniquement. "
            "AM4 (Ryzen 3000/5000) : DDR4. "
            "Intel LGA1700 : DDR4 ou DDR5 selon le modele de carte mere. "
            "Pour le gaming, 32 Go (2x16) en dual channel est recommande. "
            "Frequences typiques : DDR4-3200 a 3600, DDR5-5600 a 6000."
        ),
        category="compatibilite",
        tags=["ram", "ddr4", "ddr5", "compatibilite"],
        source="manual",
    ),
    KnowledgeDocument(
        title="Installation Windows et drivers essentiels",
        content=(
            "Apres assemblage : 1) Creer une cle USB bootable avec Media Creation Tool. "
            "2) Installer Windows 11. 3) Installer les drivers chipset du fabricant "
            "de la carte mere en premier. 4) Drivers GPU (GeForce Experience ou "
            "AMD Adrenalin). 5) Drivers reseau et audio. "
            "6) Activer XMP/EXPO pour la RAM dans le BIOS. "
            "Ne jamais installer de 'driver packs' tiers non officiels."
        ),
        category="installation",
        tags=["windows", "drivers", "installation"],
        source="manual",
    ),
    KnowledgeDocument(
        title="Choix alimentation selon GPU",
        content=(
            "Recommandations PSU 80+ Bronze minimum, Gold recommande. "
            "RTX 4060 / RX 7600 : 550W. "
            "RTX 4070 / RX 7800 XT : 650W. "
            "RTX 4070 Ti / RTX 4080 : 750W. "
            "RTX 4090 : 850-1000W. "
            "Prevoir une marge de 20-30% au-dessus de la conso estimee. "
            "Privilegiez les marques : Corsair, Seasonic, be quiet!, Super Flower."
        ),
        category="compatibilite",
        tags=["alimentation", "psu", "gpu", "wattage"],
        source="manual",
    ),
    KnowledgeDocument(
        title="Reset BIOS / Clear CMOS",
        content=(
            "Pour reinitialiser le BIOS : 1) Eteindre et debrancher l'alimentation. "
            "2) Localiser le jumper CLEAR_CMOS sur la carte mere (manuel). "
            "3) Court-circuiter 10 secondes, ou retirer la pile CR2032 pendant 5 minutes. "
            "4) Remettre et redemarrer. "
            "Utile apres un bad overclock, un ecran noir post-BIOS update, "
            "ou un oubli de mot de passe BIOS."
        ),
        category="bios",
        tags=["bios", "cmos", "reset"],
        source="manual",
    ),
    KnowledgeDocument(
        title="SSD NVMe non detecte",
        content=(
            "SSD M.2 non visible : 1) Verifier le slot M.2 utilise "
            "(certains partagent la bande passante avec un port SATA). "
            "2) Dans le BIOS, activer le controleur NVMe / changer le mode "
            "SATA de IDE vers AHCI. 3) Reseater le SSD. "
            "4) Si Windows ne le voit pas pour installation : charger les "
            "drivers RAID/NVMe du constructeur pendant le setup. "
            "5) Mettre a jour le BIOS de la carte mere."
        ),
        category="stockage",
        tags=["ssd", "nvme", "m.2", "detection"],
        source="manual",
    ),
    KnowledgeDocument(
        title="Politique de retour et garantie L'AMI",
        content=(
            "Retour sous 14 jours si produit non descellé et dans son emballage d'origine. "
            "Garantie constructeur : 2 ans pieces standard, 3 ans sur certaines marques "
            "(Samsung SSD, Corsair). "
            "Pour un SAV : creer un ticket avec numero de commande, photos, "
            "et description du defaut. "
            "Les dommages lies a un montage incorrect ou un overclock extreme "
            "peuvent exclure la garantie."
        ),
        category="sav",
        tags=["garantie", "retour", "sav"],
        source="manual",
    ),
]


async def seed_knowledge_base() -> int:
    store = await get_vector_store()
    existing = await store.count()
    if existing >= len(SEED_DOCUMENTS):
        return 0
    ids = await store.ingest(SEED_DOCUMENTS)
    return len(ids)
