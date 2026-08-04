// Legal document content for S@Learn -- founder request, 2026-08-01, ahead of
// the security/compliance/RLS pass gating beta testing. Cameroon's Law No.
// 2024/017 (Personal Data Protection, enacted 23 Dec 2024) became
// enforceable/sanctionable on 23 June 2026, which has already passed --
// this is why these documents exist now rather than being deferred further.
//
// These are RESEARCH-GROUNDED FIRST DRAFTS, not final legal instruments.
// Every document carries a visible disclaimer (rendered by
// components/Legal/LegalDocument.tsx, not duplicated in the body text here)
// stating they are not a substitute for review by a licensed Cameroonian
// attorney before the platform goes live for real users. The Instructor MSA's
// "cyber insurance" section is a scoping brief to hand to an actual insurer,
// not a policy -- this app cannot issue insurance.
//
// Bodies use the same markdown-lite syntax lib/richText.tsx already renders
// for lesson content (#/##/### headings, -/1. lists, **bold**) -- reused
// here rather than inventing a second rendering path for structured text.
//
// Content deliberately does NOT invent numbers that don't exist in the
// product yet (e.g. an instructor commission percentage -- grepped the
// codebase, no such field/logic exists anywhere, so the MSA says "to be
// defined" instead of a fabricated figure).

export type LegalDocKey = 'terms' | 'privacy' | 'dpa' | 'refund' | 'instructor-msa';

export type LegalDoc = {
  titleEn: string;
  titleFr: string;
  bodyEn: string;
  bodyFr: string;
};

export const LEGAL_DOC_ORDER: LegalDocKey[] = ['terms', 'privacy', 'dpa', 'refund', 'instructor-msa'];

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  terms: {
    titleEn: 'Terms of Service',
    titleFr: 'Conditions Générales d\'Utilisation',
    bodyEn: `**Draft version 1 — August 1, 2026**

# 1. Acceptance of these Terms

These Terms of Service ("Terms") govern access to and use of S@Learn ("Store of Learning," "S@Learn," "we," "us," "the Platform"), an online course marketplace and tutor-matching service operated from Douala, Cameroon. By creating an account or using the Platform, you agree to these Terms.

# 2. Who Uses S@Learn

- **Student accounts** browse and complete courses, and may submit tutor requests on behalf of themselves or a child in their care.
- **Instructor accounts** publish courses and, once verified, may register as tutors in the tutor-matching marketplace.
- **Parents/guardians** using a Student account to request a tutor for a child provide the child's information (grade level, general neighborhood) themselves — the child does not hold their own account or interact with the Platform directly. See our Privacy Policy for how this data is handled.

Account holders must be legally capable of entering into a binding agreement under Cameroonian law. A parent or guardian is responsible for any tutor request submitted on a child's behalf.

# 3. Course Marketplace

Instructors publish courses; Students enroll to access lessons, complete quizzes, and (where applicable) earn certificates. Course content is authored by instructors, not S@Learn — instructors are solely responsible for its accuracy and quality, subject to our moderation review before publication.

**Payment status:** as of this draft, course purchases are not being processed for real payment — see the payment button's on-screen notice for current status. This is a temporary V1 limitation, not a permanent feature removal; see our Refund Policy for how this will apply once enabled.

# 4. Tutor Marketplace

A parent submits a tutor request (subject, grade, neighborhood, and optionally a precise location); the Platform matches the request to an available verified tutor. Once matched, parent and tutor communicate through the Platform's chat, and a deposit/balance payment structure applies to confirmed sessions.

**Payment status:** as with course purchases, real payment processing for tutor deposits/balances is currently disabled for V1 — see the in-app notice at the point of payment.

A parent may cancel a still-searching request at any time, which permanently deletes the request from our systems. A matched booking follows the cancellation terms shown in-app at the time of cancellation.

# 5. Instructor Verification

Instructors who wish to tutor (not just publish courses) must complete an identity verification step, including a government-issued ID and a selfie, reviewed by our verification process. Verified status is displayed to parents choosing a tutor. Submitting false identity information is a violation of these Terms and Cameroonian law (Law No. 2010/012 on Cybersecurity and Cybercrime).

# 6. Prohibited Conduct

Users may not:
- Impersonate another person or misrepresent their identity, credentials, or verification status
- Use the Platform to solicit payment or contact outside the Platform in a way that circumvents these Terms during an active match
- Upload content that infringes another party's intellectual property, or that is unlawful under Cameroonian law
- Attempt to access another user's account, data, or private conversations without authorization
- Use the Platform to harass, threaten, or endanger a minor referenced in a tutor request

# 7. Content and Intellectual Property

Instructors retain ownership of the course content they upload, and grant S@Learn a license to host, display, and deliver it to enrolled students for as long as the course remains published. S@Learn's own branding, design, and platform code remain our property.

# 8. Account Termination

You may delete your account at any time from Account Settings, which permanently removes your profile per our account-deletion process. We may suspend or terminate an account for violation of these Terms, fraudulent verification submissions, or unlawful conduct.

# 9. Disclaimers and Limitation of Liability

S@Learn is a marketplace connecting students, parents, instructors, and tutors — we do not directly provide tutoring or teaching services ourselves, and we do not guarantee learning outcomes. To the maximum extent permitted under Cameroonian law, S@Learn's liability for any claim arising from use of the Platform is limited to the amount paid by the affected user in the preceding 12 months, if any.

# 10. Governing Law

These Terms are governed by the laws of the Republic of Cameroon, including Law No. 2010/021 governing electronic commerce and Law No. 2011/012 on consumer protection. Disputes will be subject to the jurisdiction of the competent courts of Cameroon.

# 11. Changes to These Terms

We may update these Terms as the Platform evolves (in particular as payment processing capabilities change). Material changes will be noted with an updated version date at the top of this document.

# 12. Contact

Questions about these Terms can be directed to the S@Learn team through the contact channels listed on the Platform.`,
    bodyFr: `**Version provisoire 1 — 1er août 2026**

# 1. Acceptation des présentes conditions

Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation de S@Learn (« Store of Learning », « S@Learn », « nous »), une plateforme de cours en ligne et de mise en relation avec des répétiteurs, opérée depuis Douala, Cameroun. En créant un compte ou en utilisant la Plateforme, vous acceptez ces CGU.

# 2. Qui utilise S@Learn

- Les **comptes Étudiant** parcourent et suivent des cours, et peuvent soumettre une demande de répétiteur pour eux-mêmes ou pour un enfant dont ils ont la charge.
- Les **comptes Instructeur** publient des cours et, une fois vérifiés, peuvent s'inscrire comme répétiteurs sur la place de marché de mise en relation.
- Les **parents/tuteurs** utilisant un compte Étudiant pour demander un répétiteur pour un enfant fournissent eux-mêmes les informations de l'enfant (niveau scolaire, quartier général) — l'enfant ne possède pas son propre compte et n'interagit pas directement avec la Plateforme. Voir notre Politique de Confidentialité pour le traitement de ces données.

Les titulaires de compte doivent avoir la capacité juridique de conclure un contrat en droit camerounais. Un parent ou tuteur est responsable de toute demande de répétiteur soumise au nom d'un enfant.

# 2. Place de marché des cours

Les instructeurs publient des cours ; les étudiants s'inscrivent pour accéder aux leçons, réaliser des quiz et, le cas échéant, obtenir un certificat. Le contenu des cours est rédigé par les instructeurs, non par S@Learn — les instructeurs sont seuls responsables de son exactitude et de sa qualité, sous réserve de notre modération avant publication.

**Statut du paiement :** à la date de cette version, les achats de cours ne font l'objet d'aucun traitement de paiement réel — voir l'avis affiché au moment du paiement. Il s'agit d'une limitation temporaire de la version V1, non d'une suppression définitive ; voir notre Politique de Remboursement pour son application une fois le paiement activé.

# 4. Place de marché des répétiteurs

Un parent soumet une demande de répétiteur (matière, niveau, quartier et, en option, une localisation précise) ; la Plateforme met en relation la demande avec un répétiteur vérifié disponible. Une fois la mise en relation effectuée, le parent et le répétiteur communiquent via la messagerie de la Plateforme, et une structure de paiement (acompte/solde) s'applique aux séances confirmées.

**Statut du paiement :** comme pour les achats de cours, le traitement réel des paiements d'acompte/solde des répétiteurs est actuellement désactivé pour la V1 — voir l'avis affiché dans l'application au moment du paiement.

Un parent peut annuler une demande encore en recherche à tout moment, ce qui supprime définitivement la demande de nos systèmes. Une réservation déjà mise en relation suit les conditions d'annulation affichées dans l'application au moment de l'annulation.

# 5. Vérification des instructeurs

Les instructeurs souhaitant donner des cours particuliers (et non uniquement publier des cours) doivent effectuer une étape de vérification d'identité, comprenant une pièce d'identité officielle et un selfie, examinés par notre processus de vérification. Le statut vérifié est affiché aux parents lors du choix d'un répétiteur. La soumission de fausses informations d'identité constitue une violation des présentes CGU et du droit camerounais (Loi n° 2010/012 sur la cybersécurité et la cybercriminalité).

# 6. Comportements interdits

Les utilisateurs ne peuvent pas :
- Usurper l'identité d'une autre personne ou présenter de manière trompeuse leur identité, leurs qualifications ou leur statut de vérification
- Utiliser la Plateforme pour solliciter un paiement ou un contact en dehors de la Plateforme afin de contourner les présentes CGU pendant une mise en relation active
- Publier un contenu portant atteinte à la propriété intellectuelle d'un tiers, ou illicite au regard du droit camerounais
- Tenter d'accéder au compte, aux données ou aux conversations privées d'un autre utilisateur sans autorisation
- Utiliser la Plateforme pour harceler, menacer ou mettre en danger un mineur mentionné dans une demande de répétiteur

# 7. Contenu et propriété intellectuelle

Les instructeurs conservent la propriété du contenu de cours qu'ils publient, et accordent à S@Learn une licence pour l'héberger, l'afficher et le diffuser aux étudiants inscrits tant que le cours reste publié. La marque, le design et le code de la Plateforme S@Learn restent notre propriété.

# 8. Résiliation de compte

Vous pouvez supprimer votre compte à tout moment depuis les Paramètres du compte, ce qui supprime définitivement votre profil selon notre procédure de suppression de compte. Nous pouvons suspendre ou résilier un compte en cas de violation des présentes CGU, de soumission frauduleuse lors de la vérification, ou de comportement illicite.

# 9. Avertissements et limitation de responsabilité

S@Learn est une place de marché mettant en relation étudiants, parents, instructeurs et répétiteurs — nous ne fournissons pas directement de services d'enseignement et ne garantissons aucun résultat pédagogique. Dans toute la mesure permise par le droit camerounais, la responsabilité de S@Learn pour toute réclamation liée à l'utilisation de la Plateforme est limitée au montant payé par l'utilisateur concerné au cours des 12 mois précédents, le cas échéant.

# 10. Droit applicable

Les présentes CGU sont régies par le droit de la République du Cameroun, notamment la Loi n° 2010/021 régissant le commerce électronique et la Loi n° 2011/012 relative à la protection du consommateur. Les litiges relèveront de la compétence des juridictions camerounaises compétentes.

# 11. Modifications des présentes CGU

Nous pouvons modifier ces CGU à mesure que la Plateforme évolue (notamment lorsque les capacités de traitement des paiements changeront). Les modifications substantielles seront signalées par une date de version mise à jour en haut de ce document.

# 12. Contact

Toute question relative à ces CGU peut être adressée à l'équipe S@Learn via les canaux de contact indiqués sur la Plateforme.`,
  },

  privacy: {
    titleEn: 'Privacy Policy',
    titleFr: 'Politique de Confidentialité',
    bodyEn: `**Draft version 1 — August 1, 2026**

# 1. Scope

This Privacy Policy explains what personal data S@Learn collects, why, and what rights you have over it, under Cameroon's Law No. 2024/017 relating to Personal Data Protection.

# 2. Data We Collect

- **Account data**: full name, email address, role (student or instructor)
- **Tutor request data**: subject/category, grade level, general neighborhood, and — only if you choose to share it — a precise device location, submitted by a parent/guardian on behalf of a child. The child does not create their own account.
- **Instructor verification data**: government-issued ID image and a selfie, used only for identity verification and never displayed publicly
- **Payment data**: processed by our payment provider, Stripe — S@Learn does not store your card details
- **Chat messages**: exchanged between matched parents and tutors through the Platform
- **Profile photo**: if you choose to upload one
- **Usage data**: locale preference and basic session information needed for the Platform to function

# 3. Legal Basis for Processing

We process personal data on the basis of your consent (given at account creation and, where applicable, at the point of sharing precise location or submitting a tutor request), and where necessary to perform our contract with you (delivering course access, operating the tutor marketplace).

# 4. How We Use Your Data

- To operate your account and deliver the course or tutor-matching service you requested
- To verify instructor identity before granting tutor status
- To notify you of matches, messages, and account activity
- To improve the Platform's reliability and safety

We do not sell personal data to third parties, and we do not use children's data submitted in a tutor request for any purpose beyond fulfilling that request.

# 5. Data Sharing

We share data only with the service providers necessary to operate the Platform: Stripe (payment processing), our cloud infrastructure provider (database and file storage), and, where legally required, Cameroonian authorities.

# 6. Children's Data

S@Learn's registered accounts belong to adults (parents/guardians and instructors). A child's information (grade level, general neighborhood) is submitted by a parent as part of a tutor request, not by the child. We treat this category of data with heightened care: it is used only to match a tutor request to a suitable, verified tutor, and a parent may permanently delete a still-searching request — and the child's data within it — at any time.

# 7. Data Retention

We retain account data for as long as your account is active. Tutor request data is retained for as long as the request or resulting match remains active, or is deleted immediately if you cancel a still-searching request. Deleted accounts are removed per our account-deletion process.

# 8. Your Rights

Under Law No. 2024/017, you have the right to:
- **Access** the personal data we hold about you
- **Rectify** inaccurate data (via Account Settings)
- **Erase** your data — you can permanently delete your account and associated data from Account Settings at any time
- **Port** your data in a portable format, on request
- **Object** to processing that isn't necessary for the service you've requested

To exercise a right not directly available in Account Settings, contact us through the Platform's contact channels.

# 9. Security

We use role-based database access controls (row-level security) so that users can only access data relevant to their own account, matches, or courses. Instructor verification documents are handled separately from public profile data.

# 10. Cross-Border Data Transfer

Our payment provider (Stripe) and cloud infrastructure may process data outside Cameroon. Where this occurs, we rely on those providers' own data protection safeguards and take this into account under Law No. 2024/017's cross-border transfer requirements.

# 11. Cookies and Local Storage

We use browser local storage only for functional purposes: remembering your language preference and, for guest (not-signed-in) users browsing courses, tracking guest progress locally on your device. We do not use third-party advertising trackers.

# 12. Supervisory Authority

Cameroon's Personal Data Protection Authority, established under Law No. 2024/017, is the supervisory body for data protection matters. You have the right to lodge a complaint with that Authority.

# 13. Changes to This Policy

We will update this Policy as the Platform evolves and note the change with an updated version date.

# 14. Contact

Questions about this Privacy Policy or requests regarding your data can be directed to the S@Learn team through the contact channels listed on the Platform.`,
    bodyFr: `**Version provisoire 1 — 1er août 2026**

# 1. Champ d'application

La présente Politique de Confidentialité explique quelles données personnelles S@Learn collecte, pourquoi, et quels droits vous détenez sur celles-ci, conformément à la Loi camerounaise n° 2024/017 relative à la protection des données à caractère personnel.

# 2. Données que nous collectons

- **Données de compte** : nom complet, adresse e-mail, rôle (étudiant ou instructeur)
- **Données de demande de répétiteur** : matière/catégorie, niveau scolaire, quartier général et — uniquement si vous choisissez de la partager — une localisation précise de l'appareil, soumises par un parent/tuteur au nom d'un enfant. L'enfant ne crée pas son propre compte.
- **Données de vérification des instructeurs** : image d'une pièce d'identité officielle et selfie, utilisés uniquement à des fins de vérification d'identité et jamais affichés publiquement
- **Données de paiement** : traitées par notre prestataire de paiement, Stripe — S@Learn ne stocke pas les détails de votre carte
- **Messages de discussion** : échangés entre parents et répétiteurs mis en relation via la Plateforme
- **Photo de profil** : si vous choisissez d'en télécharger une
- **Données d'utilisation** : préférence de langue et informations de session basiques nécessaires au fonctionnement de la Plateforme

# 3. Base légale du traitement

Nous traitons les données personnelles sur la base de votre consentement (donné lors de la création du compte et, le cas échéant, au moment du partage d'une localisation précise ou de la soumission d'une demande de répétiteur), et lorsque cela est nécessaire à l'exécution de notre contrat avec vous (fourniture de l'accès aux cours, fonctionnement de la place de marché des répétiteurs).

# 4. Utilisation de vos données

- Pour gérer votre compte et fournir le service de cours ou de mise en relation avec un répétiteur que vous avez demandé
- Pour vérifier l'identité de l'instructeur avant d'accorder le statut de répétiteur
- Pour vous notifier des mises en relation, messages et activités du compte
- Pour améliorer la fiabilité et la sécurité de la Plateforme

Nous ne vendons pas de données personnelles à des tiers, et nous n'utilisons les données d'un enfant soumises dans une demande de répétiteur à aucune fin autre que de répondre à cette demande.

# 5. Partage des données

Nous ne partageons les données qu'avec les prestataires de services nécessaires au fonctionnement de la Plateforme : Stripe (traitement des paiements), notre fournisseur d'infrastructure cloud (base de données et stockage de fichiers) et, lorsque la loi l'exige, les autorités camerounaises.

# 6. Données des enfants

Les comptes enregistrés sur S@Learn appartiennent à des adultes (parents/tuteurs et instructeurs). Les informations d'un enfant (niveau scolaire, quartier général) sont soumises par un parent dans le cadre d'une demande de répétiteur, non par l'enfant lui-même. Nous traitons cette catégorie de données avec une vigilance accrue : elle n'est utilisée que pour mettre en relation la demande avec un répétiteur adapté et vérifié, et un parent peut supprimer définitivement une demande encore en recherche — ainsi que les données de l'enfant qu'elle contient — à tout moment.

# 7. Conservation des données

Nous conservons les données de compte tant que votre compte est actif. Les données de demande de répétiteur sont conservées tant que la demande ou la mise en relation résultante reste active, ou sont supprimées immédiatement en cas d'annulation d'une demande encore en recherche. Les comptes supprimés sont retirés selon notre procédure de suppression de compte.

# 8. Vos droits

En vertu de la Loi n° 2024/017, vous disposez du droit :
- D'**accéder** aux données personnelles que nous détenons à votre sujet
- De **rectifier** les données inexactes (via les Paramètres du compte)
- D'**effacer** vos données — vous pouvez supprimer définitivement votre compte et les données associées depuis les Paramètres du compte à tout moment
- De **porter** vos données dans un format portable, sur demande
- De vous **opposer** à un traitement non nécessaire au service que vous avez demandé

Pour exercer un droit non directement disponible dans les Paramètres du compte, contactez-nous via les canaux de contact de la Plateforme.

# 9. Sécurité

Nous utilisons des contrôles d'accès à la base de données fondés sur les rôles (sécurité au niveau des lignes) afin que chaque utilisateur ne puisse accéder qu'aux données relatives à son propre compte, ses mises en relation ou ses cours. Les documents de vérification des instructeurs sont traités séparément des données de profil public.

# 10. Transfert transfrontalier de données

Notre prestataire de paiement (Stripe) et notre infrastructure cloud peuvent traiter des données en dehors du Cameroun. Le cas échéant, nous nous appuyons sur les garanties propres de protection des données de ces prestataires et en tenons compte au regard des exigences de transfert transfrontalier de la Loi n° 2024/017.

# 11. Cookies et stockage local

Nous utilisons le stockage local du navigateur uniquement à des fins fonctionnelles : mémoriser votre préférence de langue et, pour les utilisateurs invités (non connectés) parcourant les cours, suivre localement la progression sur votre appareil. Nous n'utilisons aucun traceur publicitaire tiers.

# 12. Autorité de contrôle

L'Autorité de Protection des Données à Caractère Personnel du Cameroun, instituée par la Loi n° 2024/017, est l'organe de contrôle compétent en matière de protection des données. Vous avez le droit de déposer une plainte auprès de cette Autorité.

# 13. Modifications de la présente Politique

Nous mettrons à jour cette Politique à mesure que la Plateforme évolue et signalerons toute modification par une date de version mise à jour.

# 14. Contact

Toute question relative à la présente Politique de Confidentialité ou toute demande concernant vos données peut être adressée à l'équipe S@Learn via les canaux de contact indiqués sur la Plateforme.`,
  },

  dpa: {
    titleEn: 'Data Processing Agreement',
    titleFr: 'Accord de Traitement des Données',
    bodyEn: `**Draft version 1 — August 1, 2026**

This Data Processing Agreement ("DPA") describes the relationship between S@Learn (acting as **data processor**) and an Instructor account (acting as **data controller**) for the student data an Instructor manages through their courses — enrollments, lesson progress, quiz results, classwork submissions, and grading.

# 1. Subject Matter and Duration

S@Learn processes student data on an Instructor's behalf for as long as the Instructor's account and courses remain active on the Platform. This DPA applies automatically to every Instructor account as part of accepting the Terms of Service — no separate signature is required, consistent with how most course-marketplace platforms structure this relationship.

# 2. Nature and Purpose of Processing

S@Learn hosts and operates the technical infrastructure (database, storage, authentication) that lets an Instructor deliver courses, review submissions, and grade classwork. S@Learn does not use student data collected through an Instructor's course for any purpose beyond operating the Platform — no marketing use, no sale, no analysis beyond what's needed to run the service and to detect abuse.

# 3. Categories of Data and Data Subjects

- **Data subjects**: students enrolled in an Instructor's course
- **Categories of data**: enrollment records, lesson completion/progress, quiz attempts and scores, classwork submissions and grades, certificate records

# 4. Processor Obligations

S@Learn commits to:
- Process student data only as necessary to operate the course/classroom features an Instructor uses
- Apply role-based access controls (row-level security) so an Instructor can only access data for students enrolled in their own courses
- Notify the Instructor without undue delay if we become aware of a data breach affecting their students' data
- Delete or return student data associated with an Instructor's account upon account deletion, consistent with our data retention practices described in the Privacy Policy

# 5. Sub-Processors

S@Learn uses the following categories of sub-processor to operate the Platform: cloud database/infrastructure hosting, and (for course purchases, once payment processing is enabled) Stripe for payment processing. We will not add a new category of sub-processor with access to student data without updating this DPA.

# 6. Data Subject Rights

Where a student (or their parent/guardian, for a minor) exercises a data protection right directly with S@Learn, we will inform the relevant Instructor where the request concerns data the Instructor controls, and support the Instructor in responding as required under Law No. 2024/017.

# 7. International Transfer

Where any sub-processor operates outside Cameroon, the safeguards described in our Privacy Policy's cross-border transfer section apply equally under this DPA.

# 8. Liability

Each party is responsible for its own compliance with Law No. 2024/017 in the role it holds (S@Learn as processor, Instructor as controller) for the categories of data described above.

# 9. Term

This DPA remains in effect for as long as the Instructor's account is active, and terminates automatically upon account deletion.`,
    bodyFr: `**Version provisoire 1 — 1er août 2026**

Le présent Accord de Traitement des Données (« ATD ») décrit la relation entre S@Learn (agissant en tant que **sous-traitant**) et un compte Instructeur (agissant en tant que **responsable de traitement**) pour les données des étudiants qu'un Instructeur gère via ses cours — inscriptions, progression des leçons, résultats de quiz, travaux remis et notation.

# 1. Objet et durée

S@Learn traite les données des étudiants pour le compte d'un Instructeur tant que le compte et les cours de l'Instructeur restent actifs sur la Plateforme. Cet ATD s'applique automatiquement à tout compte Instructeur dans le cadre de l'acceptation des CGU — aucune signature séparée n'est requise, conformément à la structure adoptée par la plupart des plateformes de cours en ligne.

# 2. Nature et finalité du traitement

S@Learn héberge et exploite l'infrastructure technique (base de données, stockage, authentification) permettant à un Instructeur de dispenser des cours, d'examiner les travaux remis et de noter les devoirs. S@Learn n'utilise les données des étudiants collectées via le cours d'un Instructeur à aucune fin autre que l'exploitation de la Plateforme — aucun usage marketing, aucune vente, aucune analyse au-delà de ce qui est nécessaire pour faire fonctionner le service et détecter les abus.

# 3. Catégories de données et personnes concernées

- **Personnes concernées** : étudiants inscrits au cours d'un Instructeur
- **Catégories de données** : dossiers d'inscription, progression/achèvement des leçons, tentatives et résultats de quiz, travaux remis et notes, dossiers de certificats

# 4. Obligations du sous-traitant

S@Learn s'engage à :
- Ne traiter les données des étudiants que dans la mesure nécessaire au fonctionnement des fonctionnalités de cours/classe utilisées par un Instructeur
- Appliquer des contrôles d'accès fondés sur les rôles (sécurité au niveau des lignes) afin qu'un Instructeur ne puisse accéder qu'aux données des étudiants inscrits à ses propres cours
- Informer l'Instructeur sans retard indu en cas de violation de données affectant les données de ses étudiants
- Supprimer ou restituer les données des étudiants associées au compte d'un Instructeur lors de la suppression du compte, conformément à nos pratiques de conservation décrites dans la Politique de Confidentialité

# 5. Sous-traitants ultérieurs

S@Learn fait appel aux catégories de sous-traitants ultérieurs suivantes pour exploiter la Plateforme : hébergement de base de données/infrastructure cloud, et (pour les achats de cours, une fois le traitement des paiements activé) Stripe pour le traitement des paiements. Nous n'ajouterons pas de nouvelle catégorie de sous-traitant ayant accès aux données des étudiants sans mettre à jour cet ATD.

# 6. Droits des personnes concernées

Lorsqu'un étudiant (ou son parent/tuteur, pour un mineur) exerce un droit de protection des données directement auprès de S@Learn, nous en informerons l'Instructeur concerné lorsque la demande porte sur des données dont l'Instructeur est responsable, et nous soutiendrons l'Instructeur dans sa réponse conformément à la Loi n° 2024/017.

# 7. Transfert international

Lorsqu'un sous-traitant ultérieur opère en dehors du Cameroun, les garanties décrites dans la section relative au transfert transfrontalier de notre Politique de Confidentialité s'appliquent également dans le cadre du présent ATD.

# 8. Responsabilité

Chaque partie est responsable de sa propre conformité à la Loi n° 2024/017 dans le rôle qu'elle occupe (S@Learn en tant que sous-traitant, l'Instructeur en tant que responsable de traitement) pour les catégories de données décrites ci-dessus.

# 9. Durée

Le présent ATD reste en vigueur tant que le compte de l'Instructeur est actif, et prend fin automatiquement lors de la suppression du compte.`,
  },

  refund: {
    titleEn: 'Refund Policy',
    titleFr: 'Politique de Remboursement',
    bodyEn: `**Draft version 1 — August 1, 2026**

# Current Status

As of this draft, S@Learn is not processing live payments for either course purchases or tutor deposit/balance payments — both show an in-app notice explaining this at the point of payment. This Refund Policy describes how refunds will work once payment processing is enabled, so the terms are set before real money is involved.

# 1. Course Purchases

Once enabled, course purchase refunds will be available within a defined window from the date of purchase (to be confirmed before payments go live), provided the course has not been substantially completed. Requests are made through Account Settings or by contacting the S@Learn team.

# 2. Tutor Deposits and Balances

- **Deposit**: paid to confirm a tutor match. If a booking is cancelled before the confirmed session date, the deposit refund follows the cancellation terms shown at the time of booking.
- **Balance**: paid on-site or confirmed manually by the tutor after a session; balance payments are between the parent and tutor directly and are not held by S@Learn, so balance refunds are a matter between the parties involved.

# 3. Non-Refundable Circumstances

Refunds will not be issued where a course has been substantially completed, where a tutoring session has already taken place, or where the request is made outside the applicable refund window.

# 4. How to Request a Refund

Once payments are live, refund requests can be made through the relevant booking/purchase page in the app, or by contacting the S@Learn team through the Platform's contact channels.

# 5. Processing Time

Approved refunds will be processed back to the original payment method within the timeframe standard for our payment processor (Stripe), typically 5-10 business days.

# 6. Consumer Protection

This policy is intended to align with Cameroon's Law No. 2011/012 on consumer protection. Nothing in this policy limits any right you have under that law.`,
    bodyFr: `**Version provisoire 1 — 1er août 2026**

# Statut actuel

À la date de cette version, S@Learn ne traite aucun paiement réel, que ce soit pour les achats de cours ou pour les paiements d'acompte/solde des répétiteurs — les deux affichent un avis dans l'application à ce sujet au moment du paiement. Cette Politique de Remboursement décrit le fonctionnement des remboursements une fois le traitement des paiements activé, afin que les conditions soient établies avant que de l'argent réel ne soit en jeu.

# 1. Achats de cours

Une fois activés, les remboursements des achats de cours seront disponibles dans un délai défini à compter de la date d'achat (à confirmer avant la mise en service des paiements), à condition que le cours n'ait pas été substantiellement terminé. Les demandes se font via les Paramètres du compte ou en contactant l'équipe S@Learn.

# 2. Acomptes et soldes des répétiteurs

- **Acompte** : versé pour confirmer une mise en relation avec un répétiteur. Si une réservation est annulée avant la date de séance confirmée, le remboursement de l'acompte suit les conditions d'annulation affichées au moment de la réservation.
- **Solde** : payé sur place ou confirmé manuellement par le répétiteur après une séance ; les paiements de solde s'effectuent directement entre le parent et le répétiteur et ne sont pas détenus par S@Learn — les remboursements de solde relèvent donc des parties concernées.

# 3. Cas non remboursables

Aucun remboursement ne sera émis lorsque le cours a été substantiellement terminé, lorsqu'une séance de répétition a déjà eu lieu, ou lorsque la demande est faite en dehors du délai de remboursement applicable.

# 4. Comment demander un remboursement

Une fois les paiements activés, les demandes de remboursement pourront être effectuées via la page de réservation/achat concernée dans l'application, ou en contactant l'équipe S@Learn via les canaux de contact de la Plateforme.

# 5. Délai de traitement

Les remboursements approuvés seront reversés sur le moyen de paiement d'origine dans le délai standard de notre prestataire de paiement (Stripe), généralement 5 à 10 jours ouvrés.

# 6. Protection du consommateur

Cette politique vise à s'aligner sur la Loi camerounaise n° 2011/012 relative à la protection du consommateur. Aucune disposition de cette politique ne limite les droits qui vous sont accordés par cette loi.`,
  },

  'instructor-msa': {
    titleEn: 'Instructor Master Services Agreement & Cyber Insurance Brief',
    titleFr: 'Contrat-Cadre Instructeur & Note de Cadrage Assurance Cyber',
    bodyEn: `**Draft version 1 — August 1, 2026**

# Part A — Instructor Master Services Agreement (MSA)

This MSA supplements the Terms of Service for Instructor accounts and governs the relationship between S@Learn and an Instructor publishing courses and/or offering tutoring services.

## 1. Eligibility and Verification

Publishing a course requires an Instructor account in good standing. Offering tutoring services (appearing in the tutor-matching marketplace) additionally requires completing identity verification (government ID + selfie), reviewed before verified status is granted.

## 2. Content Standards

Course content must be original or properly licensed, accurate to the best of the Instructor's knowledge, and free of content prohibited under these Terms (Section 6 of the Terms of Service). S@Learn reserves the right to moderate, request changes to, or unpublish content that doesn't meet these standards.

## 3. Payment Terms

**Current status**: real payment processing for both course purchases and tutor sessions is disabled for V1 (see the Refund Policy). Instructors relying on manual, off-platform payment arrangements (e.g. the existing "Add Student" enrollment flow, or on-site cash/mobile money for tutor sessions) remain responsible for their own payment collection until platform-processed payments are enabled.

**Platform fee**: to be defined and communicated to Instructors before monetization of course/tutor payments goes live — no commission structure exists in the Platform today.

## 4. Content Ownership and License

Instructors retain ownership of their course content and grant S@Learn a license to host and deliver it to enrolled students for as long as the course stays published, as described in the Terms of Service.

## 5. Conduct Standards

Instructors acting as tutors must conduct themselves professionally, particularly given that tutoring sessions may involve minors. Any conduct that endangers a student, misrepresents qualifications, or violates the Terms of Service's prohibited-conduct section is grounds for immediate suspension.

## 6. Termination

Either party may end this relationship by the Instructor deleting their account, or by S@Learn suspending/terminating the account per the Terms of Service. Published courses and pending tutor matches will be handled per the account-deletion process at the time.

## 7. Indemnification

Instructors are responsible for the accuracy of their course content and the conduct of their tutoring sessions, and agree to indemnify S@Learn against claims arising from content they published or conduct during a tutoring engagement, to the extent permitted under Cameroonian law.

---

# Part B — Cyber Insurance Scoping Brief

**This is a scoping document to support a conversation with a licensed Cameroonian insurance broker or underwriter — it is not an insurance policy, and S@Learn cannot issue insurance coverage.**

## Purpose

As S@Learn approaches beta testing and eventual live payment processing, the Platform's risk profile includes categories an insurer would typically want to underwrite. This brief summarizes that profile for an insurance conversation.

## Data Held (relevant to cyber/data-breach coverage)

- Personal data: names, emails, roles for all registered users
- Sensitive data: children's grade level and general neighborhood (submitted via tutor requests), precise geolocation (optional, parent-shared), government ID images and selfies (instructor verification)
- Payment data: not stored directly — processed via Stripe

## Third-Party Processors (relevant to vendor/supply-chain risk)

- Stripe (payment processing, once enabled)
- Cloud database/infrastructure provider (hosting all application data)

## Coverage Areas Likely Relevant

- **Data breach / cyber liability**: given the categories of sensitive data above, particularly children's information and identity verification documents
- **Professional liability (errors & omissions)**: for claims arising from tutoring advice or course content quality
- **Payment processing liability**: once course/tutor payments go live, covering disputes, chargebacks, or processing failures
- **Business interruption**: platform downtime affecting active tutor matches or in-progress courses

## Scale Indicators to Provide an Insurer

Current user counts, course counts, and active tutor-match volume should be pulled from the Platform's live metrics at the time of the insurance conversation (see \`AdminMetrics.tsx\` in the codebase, or the equivalent admin dashboard) rather than estimated here, since this brief is a point-in-time document and those numbers will be out of date quickly.`,
    bodyFr: `**Version provisoire 1 — 1er août 2026**

# Partie A — Contrat-Cadre de Services Instructeur (« MSA »)

Ce MSA complète les CGU pour les comptes Instructeur et régit la relation entre S@Learn et un Instructeur publiant des cours et/ou proposant des services de répétition.

## 1. Éligibilité et vérification

La publication d'un cours nécessite un compte Instructeur en règle. La proposition de services de répétition (apparition sur la place de marché de mise en relation) nécessite en outre l'achèvement de la vérification d'identité (pièce d'identité officielle + selfie), examinée avant l'octroi du statut vérifié.

## 2. Normes de contenu

Le contenu des cours doit être original ou dûment autorisé, exact au meilleur de la connaissance de l'Instructeur, et exempt de tout contenu interdit par les présentes CGU (Section 6 des CGU). S@Learn se réserve le droit de modérer, de demander des modifications ou de dépublier tout contenu ne respectant pas ces normes.

## 3. Conditions de paiement

**Statut actuel** : le traitement réel des paiements, tant pour les achats de cours que pour les séances de répétition, est désactivé pour la V1 (voir la Politique de Remboursement). Les Instructeurs s'appuyant sur des arrangements de paiement manuels hors plateforme (par exemple le flux d'inscription « Ajouter un étudiant » existant, ou les paiements en espèces/mobile money sur place pour les séances de répétition) restent responsables de leur propre collecte de paiement jusqu'à l'activation des paiements traités par la plateforme.

**Frais de plateforme** : à définir et à communiquer aux Instructeurs avant la mise en service de la monétisation des paiements de cours/répétition — aucune structure de commission n'existe actuellement sur la Plateforme.

## 4. Propriété et licence du contenu

Les Instructeurs conservent la propriété de leur contenu de cours et accordent à S@Learn une licence pour l'héberger et le diffuser aux étudiants inscrits tant que le cours reste publié, comme décrit dans les CGU.

## 5. Normes de conduite

Les Instructeurs agissant en tant que répétiteurs doivent se comporter de manière professionnelle, en particulier compte tenu du fait que les séances de répétition peuvent impliquer des mineurs. Tout comportement mettant en danger un étudiant, présentant de manière trompeuse des qualifications, ou violant la section relative aux comportements interdits des CGU constitue un motif de suspension immédiate.

## 6. Résiliation

Chaque partie peut mettre fin à cette relation, l'Instructeur en supprimant son compte, ou S@Learn en suspendant/résiliant le compte conformément aux CGU. Les cours publiés et les mises en relation de répétiteurs en attente seront traités selon la procédure de suppression de compte en vigueur à ce moment.

## 7. Indemnisation

Les Instructeurs sont responsables de l'exactitude de leur contenu de cours et de la conduite de leurs séances de répétition, et acceptent d'indemniser S@Learn contre toute réclamation découlant du contenu qu'ils ont publié ou de leur conduite lors d'une séance de répétition, dans la mesure permise par le droit camerounais.

---

# Partie B — Note de cadrage assurance cyber

**Ce document est une note de cadrage destinée à alimenter une discussion avec un courtier ou assureur camerounais agréé — ce n'est pas une police d'assurance, et S@Learn ne peut émettre de couverture d'assurance.**

## Objectif

À l'approche des tests bêta de S@Learn et du traitement futur des paiements réels, le profil de risque de la Plateforme comprend des catégories qu'un assureur voudrait généralement couvrir. Cette note résume ce profil pour une discussion avec un assureur.

## Données détenues (pertinentes pour la couverture cyber/violation de données)

- Données personnelles : noms, e-mails, rôles de tous les utilisateurs enregistrés
- Données sensibles : niveau scolaire et quartier général des enfants (soumis via les demandes de répétiteur), localisation précise (optionnelle, partagée par le parent), images de pièces d'identité et selfies (vérification des instructeurs)
- Données de paiement : non stockées directement — traitées via Stripe

## Sous-traitants tiers (pertinents pour le risque fournisseur/chaîne d'approvisionnement)

- Stripe (traitement des paiements, une fois activé)
- Fournisseur de base de données/infrastructure cloud (hébergement de toutes les données de l'application)

## Domaines de couverture probablement pertinents

- **Violation de données / responsabilité cyber** : compte tenu des catégories de données sensibles ci-dessus, en particulier les informations des enfants et les documents de vérification d'identité
- **Responsabilité professionnelle (erreurs et omissions)** : pour les réclamations découlant de conseils de répétition ou de la qualité du contenu des cours
- **Responsabilité liée au traitement des paiements** : une fois les paiements de cours/répétition activés, couvrant les litiges, rétrofacturations ou échecs de traitement
- **Interruption d'activité** : indisponibilité de la plateforme affectant des mises en relation de répétiteurs actives ou des cours en cours

## Indicateurs d'échelle à fournir à un assureur

Le nombre actuel d'utilisateurs, de cours et le volume de mises en relation actives devraient être extraits des métriques en direct de la Plateforme au moment de la discussion avec l'assureur (voir \`AdminMetrics.tsx\` dans le code, ou le tableau de bord d'administration équivalent) plutôt qu'estimés ici, cette note étant un document ponctuel dont les chiffres seraient rapidement obsolètes.`,
  },
};
