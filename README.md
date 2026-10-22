# NEOTRADE — Réception à quai (PWA)

Application mobile pour contrôler à quai chaque camion Kuehne+Nagel (agence Hauneck, relation X085)
reçu par NEOTRADE / SAS KASMI, 2 rue de Pâques, 62138 Douvrin.

> 🚧 Construite par étapes. **En production** (neotrade-reception.vercel.app) : lecture des CMR et scan des colis.
> Prochaines étapes : import du fichier Kuehne+Nagel, puis clôture et litiges (voir *Avancement*).

## Stack

Même socle que le site B2B (dossier parent) : Next.js 15 (App Router) + TypeScript, Tailwind CSS 4,
Prisma 6, Auth.js, Zod, Vitest. Différences : **PostgreSQL aussi en développement** et application
installable (PWA : `src/app/manifest.ts` + `public/sw.js`).

## Lancer en local

Prérequis : Node.js 20+, PostgreSQL 14+ (local, Docker ou Supabase).

```bash
cd neotrade-reception
npm install
cp .env.example .env          # compléter POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, AUTH_SECRET, SEED_MANAGER_PIN
npm run db:deploy             # crée les tables
npm run db:seed               # premier responsable + cariste démo + 2 réceptions d'exemple
npm run dev                   # http://localhost:3001
```

PostgreSQL avec Docker : `docker run -d --name reception-db -p 5432:5432 -e POSTGRES_USER=reception -e POSTGRES_PASSWORD=reception -e POSTGRES_DB=reception postgres:16`

Comptes du seed : **Responsable** (PIN = `SEED_MANAGER_PIN`) et **Cariste démo** (PIN `1357`).
Cinq erreurs de PIN bloquent le compte 15 minutes.

Le service worker n'est actif qu'en production : pour tester le hors-ligne, `npm run build && npm start`.

## Nouveau camion : lecture automatique de la CMR

1. Le cariste photographie la CMR-Ladeliste (toutes les pages) et, si possible, le Fahrauftrag (plombs).
   Les photos sont réduites sur le téléphone (2200 px, JPEG) avant envoi. 8 photos au plus par lecture.
2. `POST /api/cmr/lire` conserve les photos puis les fait lire par Claude (`src/lib/cmr/extract.ts`, modèle `claude-opus-5-5`).
   Le schéma JSON attendu (`src/lib/cmr/schema.ts`) est donné dans la consigne et la réponse est validée par Zod
   (`parseExtraction`) : la sortie structurée imposée par l'API est refusée pour ce schéma (« compiled grammar is too large »).
   Si le modèle refuse pour une raison de sécurité, l'API rejoue la demande sur son modèle de secours (option `fallbacks: "default"`).
   Toute erreur de l'API Anthropic est écrite dans les logs Vercel (« Lecture CMR — API Anthropic ») ; l'écran n'affiche qu'un code.
3. `src/lib/cmr/analyze.ts` construit la réception et les contrôles : somme des positions = ENDSUMMEN et W-WERT,
   recoupement avec le Fahrauftrag (envois, colis, poids, immatriculations, n° Reise), positions hors adresse,
   envois groupés, n° imprimés en double, notes manuscrites. `src/lib/cmr/context.ts` ajoute les contrôles en base :
   liste déjà enregistrée, colis manquant d'un camion précédent qui revient (même n° imprimé).
4. L'utilisateur relit, corrige si besoin, puis crée la réception. Les litiges ouverts correspondants passent à « retrouvé ».

Sans clé `ANTHROPIC_API_KEY`, la saisie manuelle reste disponible. `CMR_EXTRACTION_MOCK=true` permet de tester
sans clé : toute photo est lue comme l'exemple réel 80977/652747 (`src/lib/cmr/fixture.ts`).
Coût mesuré (octobre 2026) : environ 0,07 $ par page, soit ~1,40 $ par camion de 20 pages et ~336 $ par an
(1 camion par jour, 20 jours par mois). Pistes pour réduire : effort `low`, cache de la consigne, ou recevoir de
Kuehne+Nagel la liste de chargement en fichier (Excel/CSV, demande envoyée) : plus de lecture par Claude, donc gratuit.

## Scan des colis au déchargement

Écran `/receptions/[id]/scan` : caméra, douchette (clavier HID, validée par Entrée, ex. douchette Bluetooth) ou saisie.

- **Caméra** (`src/components/CameraScanner.tsx`) : lecteur natif Android ; sur iPhone, ZXing-C++ en WebAssembly
  (paquet `barcode-detector`). Le fichier `.wasm` est copié dans `public/wasm` à l'installation (`scripts/copy-wasm.mjs`)
  et mis en cache par le service worker : la lecture marche hors ligne. Seule la zone du viseur est analysée ; mise au point
  continue et zoom ×2 si le téléphone le permet (scanner à 25-30 cm). Laser rouge, cadre vert « ✓ » et bip à chaque lecture
  (le son est débloqué au premier toucher : Safari le bloque avant). L'aperçu est un canvas posé sur la vidéo, pour que
  Safari ne l'ouvre pas en plein écran au toucher.
- **iPhone : ouvrir l'app depuis son icône** (Safari → Partager → *Sur l'écran d'accueil*), jamais depuis un lien
  WhatsApp / e-mail : leurs navigateurs intégrés lancent toute vidéo, donc la caméra, en plein écran.

- **Rapprochement** (`src/lib/scan/match.ts`, testé sur une vraie étiquette Amazon) : l'étiquette porte
  `00340312892450832619` (AI 00 + SSCC), la CMR n'en imprime que le début `00340312892450832` → comparaison par préfixe.
  Repli sur le n° d'envoi (étiquettes K+N). Code non numérique (code du bas de l'étiquette) → « mauvais code-barres ».
- **Résultats** : reçu, déjà scanné, colis en trop, hors adresse (à mettre de côté), non prévu sur la CMR.
  « +1 » compte à la main (étiquette illisible, palettes d'un envoi groupé). Avarie : type, commentaire, photo. Annulation du dernier scan.
- **Hors ligne** : chaque scan est écrit dans IndexedDB (`src/lib/client/outbox.ts`) avant tout envoi, puis synchronisé
  (`POST /api/receptions/[id]/scans`) dès que le réseau revient. Le serveur refait le rapprochement, recalcule les compteurs
  et les statuts ; un même scan renvoyé deux fois ne compte qu'une fois. Plusieurs téléphones peuvent scanner le même camion :
  les synchros d'un même camion passent l'une après l'autre (verrou PostgreSQL `pg_advisory_xact_lock`), une étiquette
  envoyée au même instant par deux téléphones n'est comptée qu'une fois.

## Langues

Français, English, Deutsch, العربية (arabe : affichage de droite à gauche, chiffres latins, codes toujours de gauche à droite).

- Choix sur l'écran de connexion ou dans **Réglages** ; la langue est retenue sur le téléphone (cookie) et dans le profil :
  un cariste retrouve sa langue en se connectant sur n'importe quel téléphone. Sans choix : langue du navigateur.
- Textes : `src/i18n/dictionaries/` (le français fait référence ; le compilateur et `dictionaries.test.ts`
  signalent toute traduction manquante). Ajouter une langue : un fichier, puis `src/i18n/config.ts`.
- Les contrôles de lecture CMR et les erreurs serveur sont stockés et renvoyés sous forme de **codes**, traduits à l'affichage :
  une fiche importée par un cariste arabophone s'affiche en français pour le responsable.

## Réglages (par téléphone)

Langue, bip et vibration au scan, déconnexion (avec alerte s'il reste des scans non envoyés), gestion des utilisateurs
pour un responsable, aide à l'installation. La déconnexion n'est plus dans l'en-tête (évite les sorties par erreur avec des gants).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Développement / build / serveur de production (port 3001) |
| `npm run typecheck` · `npm test` | TypeScript · tests Vitest |
| `npm run db:migrate` | Nouvelle migration après modification du schéma |
| `npm run db:deploy` | Applique les migrations (production) |
| `npm run db:seed` · `npm run db:studio` | Données initiales · Prisma Studio |
| `npm run icons` | Régénère les icônes PNG de la PWA |

## Modèle de données (`prisma/schema.prisma`)

| Modèle | Rôle |
|---|---|
| `User` | Nom + PIN haché, rôle `CARISTE` / `RESPONSABLE`, blocage après erreurs |
| `Reception` | Un camion : n° liste, n° Reise, relation, véhicule, remorque, plombs attendus/constatés, totaux attendus (colis, kg, €), arrivée réelle, statut `BROUILLON` → `EN_CONTROLE` → `CLOTUREE`, contrôleur |
| `Position` | Ligne de la liste : n° d'envoi (+ clé normalisée), n° imprimé, désignation, expéditeur, adresse, colis attendus/reçus, kg, €, n° Bordero (plusieurs), groupé, statut `ATTENDU` / `RECU` / `PARTIEL` / `MANQUANT` / `HORS_ADRESSE` |
| `Scan` | Code brut + normalisé, type de rapprochement, quantité, état (OK / endommagé + type), utilisateur, heure ; `clientId` unique pour une synchro hors-ligne sans doublon |
| `Photo` | Clé du fichier dans le stockage, rattachée à une réception / position / scan / litige |
| `ReceptionNote` | Notes manuscrites (« 25 Missing Box ») et observations, avec nb de colis annoncés manquants |
| `Dispute` | Litige : position et camion d'origine, kg, €, statut, camion où il a été retrouvé, ancien et nouveau n° d'envoi |

Cas difficiles pris en compte dans le modèle :
1. **Envoi groupé** : `Position.isGrouped`, `borderoNumbers[]`, `Scan.quantity` pour compter plusieurs palettes.
2. **N° imprimé en double** : `printedNumber` indexé mais pas unique.
3. **Manquant revenu sous un nouveau n° d'envoi** : `Dispute.printedNumber` sert de clé de rapprochement, `newShipmentNumber` garde le nouveau n°.
4. **Hors adresse** : `isOffAddress` (calculé depuis CP/ville, `src/lib/site.ts`) ; exclu des colis reçus/attendus de Douvrin.
5. **Notes manuscrites** : `ReceptionNote` (`MANUSCRITE`, `declaredMissingPackages`) + photo `NOTE_MANUSCRITE`.

Montants en centimes d'euro, poids en kg décimaux, heures affichées en heure de Paris.

## Mise en ligne (Supabase + Vercel), possible entièrement depuis un téléphone

1. **Vercel** : importer le dépôt GitHub (Root Directory vide). `vercel.json` fixe la commande de build
   (`prisma migrate deploy && next build`, les tables sont créées au déploiement) et la région Paris.
2. **Supabase** : Vercel → *Integrations → Supabase → Link Existing Supabase Account*, relier le projet Supabase
   au projet Vercel. L'intégration remplit seule `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PASSWORD`,
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Le bucket privé `reception` est créé au premier envoi de photo.
   `AUTH_SECRET` est facultatif (dérivé de `POSTGRES_PASSWORD` à défaut).
3. **À saisir à la main dans Vercel** : `SETUP_CODE` (obligatoire pour le premier démarrage) et, pour la lecture des CMR,
   `ANTHROPIC_API_KEY` (platform.claude.com → Clés API ; prévoir du crédit dans Facturation). Si la clé n'est rattachée à
   aucun espace de travail (préfixe `sk-ant-usr-`), ajouter aussi `ANTHROPIC_WORKSPACE_ID` (`wrkspc_…`, page Espaces de
   travail) : sinon l'API refuse la lecture. En production, les deux sont en place. Redéployer après tout ajout de variable.
4. **Premier démarrage** : ouvrir l'adresse Vercel, « Premier démarrage », saisir `SETUP_CODE`, créer le premier responsable.
   Il ajoute ensuite les caristes dans *Gérer les utilisateurs* (ajout, nouveau PIN, déblocage, désactivation).
5. **iPhone** : ouvrir l'adresse dans **Safari** → Partager → *Sur l'écran d'accueil*. **Android** : Chrome → ⋮ → *Installer l'application*.

HTTPS (fourni par Vercel) est obligatoire pour l'installation et la caméra. La lecture d'une CMR doit tenir en 60 s
(maximum du forfait gratuit Vercel). Le forfait gratuit Vercel (Hobby) est réservé à un usage non commercial :
pour un usage professionnel, prévoir le forfait Pro.

Sécurité de la connexion : chaque essai de PIN est compté avant la comparaison, en une seule requête conditionnelle
(`src/auth.ts`) ; des connexions envoyées en rafale ne peuvent pas tester plus de 5 codes avant le blocage de 15 minutes.

## Travailler sur le projet

Le code de référence est sur GitHub (`samynueve/neotrade-reception`). Tout envoi sur `main` est mis en ligne par Vercel.
Développement avec Claude Code dans le cloud (claude.ai/code, environnement « Github », sans script de configuration :
installer avec `npm ci` dans la session) : chaque session travaille sur sa branche et propose une pull request, mise en
ligne au *Merge*. Les variables de Vercel ne valent que pour la Production : les aperçus des pull requests ne marchent pas
sans les copier aussi en *Preview*.

## Avancement

- [x] **Étape 1 — Socle** : projet, base PostgreSQL, modèle de données, connexion nom + PIN, rôles, accueil (liste des réceptions, colis reçus/attendus, bouton Nouveau camion), création d'une réception, fiche en lecture, PWA (manifest, icônes, service worker, page hors ligne)
- [x] **Étape 2 — Lecture automatique** : photo de la CMR et du Fahrauftrag → réception pré-remplie et contrôlée, relecture, couleurs NEOTRADE
- [x] Finitions : 4 langues (dont arabe), réglages, plombs constatés, pages d'erreur et de chargement, formulaires qui gardent la saisie
- [ ] Photos du camion à l'arrivée
- [x] **Étape 3 — Scan** : caméra / douchette / saisie, rapprochement avec la CMR, avaries, file hors ligne IndexedDB et synchronisation
- [x] Comptes : premier démarrage depuis le téléphone, gestion des utilisateurs par le responsable
- [x] Mise en production (octobre 2026) : lecture des CMR et scan iPhone validés sur le terrain
- [ ] Tester deux téléphones qui scannent le même camion en même temps (un colis ne doit compter qu'une fois)
- [ ] Import de la liste de chargement envoyée par Kuehne+Nagel en fichier (Excel/CSV ou PDF généré) : en attente d'un exemple de K+N
- [ ] Étape 4 — Clôture, litiges et rapprochement entre camions
- [ ] Étape 5 — Rapport de réception (PDF / impression)
