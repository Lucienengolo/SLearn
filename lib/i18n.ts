export type Locale = 'fr' | 'en';

const LOCALE_STORAGE_KEY = 'slearn_locale';

// Phase 1 of a platform-wide i18n sweep (founder feedback, 2026-07-29:
// "the language doesn't apply to all the platform"). An audit found only 4
// of ~53 component files used this dictionary at all -- everything else was
// hardcoded (the tutor-marketplace flow in French, everything else in
// English), so the FR/EN toggle only ever moved the header nav regardless
// of what page you were on. Given the real size of a full sweep (~1,500
// strings), rolling out in phases, public/marketing surfaces first: Header
// (done previously), then Home/Landing/Footer/course-browsing chrome
// (this phase). Course/lesson CONTENT itself (course.description,
// lesson.content, reviews) stays untranslated -- that's instructor-authored
// data, a different problem from UI copy, not covered by this dictionary.
// Remaining phases (both dashboards, tutor-marketplace flow, account
// settings, auth modal) are tracked in TODOS.md.
export const translations = {
  fr: {
    'nav.home': 'Accueil',
    'nav.courses': 'Cours',
    'nav.dashboard': 'Tableau de bord',
    'nav.tutors': 'Trouver un tuteur',
    'nav.audience.individual': 'Particuliers',
    'nav.audience.schools': 'Écoles & universités',
    'nav.audience.business': 'Entreprises',
    'nav.audience.government': 'Gouvernements',
    'nav.reviewQueue': 'File de révision',
    'nav.accountSettings': 'Paramètres du compte',
    'nav.signIn': 'Se connecter',
    'nav.signOut': 'Se déconnecter',
    'nav.openMenu': 'Ouvrir le menu',
    'nav.closeMenu': 'Fermer le menu',
    'guest.xpLabel': 'XP invité (cette session)',

    'common.builtForLearners': 'Conçu pour les apprenants africains',
    'common.trust.courses': 'cours',
    'common.trust.learners': 'apprenants',
    'common.trust.instructors': 'instructeurs experts',
    'common.trust.lowData': 'Fonctionne avec peu de données',
    'common.searchPlaceholder': 'Rechercher des cours...',
    'common.searchAria': 'Rechercher des cours',
    'common.browseCourses': 'Parcourir les cours',
    'common.free': 'Gratuit',
    'common.loadingEllipsis': 'Chargement…',

    'home.hero.title': 'Apprenez les compétences qui font grandir vos revenus',
    'home.hero.subtitle':
      "Des cours pratiques dispensés par des experts locaux — créez, commercialisez et menez de vrais projets. Apprenez à votre rythme, sur tout appareil, même avec une connexion lente.",
    'home.hero.search': 'Rechercher',
    'home.hero.topics.web': 'Développement web',
    'home.hero.topics.marketing': 'Marketing digital',
    'home.hero.topics.data': 'Analyse de données',
    'home.hero.topics.design': 'Design',
    'home.categories.all': 'Tout',
    'home.featured.eyebrow': 'Le plus populaire',
    'home.featured.title': 'Cours à la une',
    'home.featured.viewAll': 'Tout voir',
    'home.featured.empty': 'Aucun cours disponible pour le moment',
    'home.instructorCta.eyebrow': 'Pour les instructeurs',
    'home.instructorCta.title': 'Enseignez ce que vous savez. Gagnez en grandissant.',
    'home.instructorCta.body':
      "Publiez votre premier cours en un après-midi. Nous gérons l'hébergement, les paiements et les certificats — vous vous concentrez sur vos étudiants.",
    'home.instructorCta.button': 'Devenir instructeur',
    'home.instructorCta.terms': "Gratuit pour commencer · Gardez jusqu'à 85 % des ventes",
    'home.whyChoose.title': 'Pourquoi choisir S@Learn ?',
    'home.whyChoose.pace.title': 'Apprenez à votre rythme',
    'home.whyChoose.pace.body': 'Accédez aux cours à tout moment, où que vous soyez',
    'home.whyChoose.certificates.title': 'Obtenez des certificats',
    'home.whyChoose.certificates.body': 'Faites reconnaître vos réussites',
    'home.whyChoose.experts.title': 'Instructeurs experts',
    'home.whyChoose.experts.body': 'Apprenez auprès de professionnels du secteur',

    'landing.hero.title':
      'Une plateforme pour apprendre, enseigner et être accompagné — pensée pour la façon dont vous vous connectez réellement',
    'landing.hero.subtitle':
      "Des cours pratiques dispensés par des experts locaux, une place de marché pour réserver des tuteurs vérifiés, et des certificats qui comptent vraiment. Fonctionne sur tout appareil, même avec une connexion lente.",
    'landing.hero.getStarted': 'Commencer gratuitement',
    'landing.whatWeDo.eyebrow': 'Ce que nous faisons',
    'landing.whatWeDo.title': 'Tout pour apprendre et grandir',
    'landing.pillars.courses.title': 'Cours pratiques',
    'landing.pillars.courses.body':
      "Acquérez de vraies compétences génératrices de revenus auprès d'experts locaux — à votre rythme, sur tout appareil.",
    'landing.pillars.tutors.title': 'Tuteurs vérifiés',
    'landing.pillars.tutors.body':
      "Réservez un tuteur vérifié et dont l'identité a été contrôlée pour votre enfant, en fonction de votre quartier et de votre budget.",
    'landing.pillars.certificates.title': 'Certificats réels',
    'landing.pillars.certificates.body':
      "Terminez un cours, réussissez l'examen final, et obtenez un certificat qui prouve ce que vous avez vraiment appris.",
    'landing.testimonials.eyebrow': 'Par de vrais étudiants',
    'landing.testimonials.title': 'Ce que disent les apprenants',
    'landing.vision.eyebrow': 'Notre vision',
    'landing.vision.title': 'De classe mondiale, pensé pour nous',
    'landing.vision.body':
      "Pas une version simplifiée d'un produit occidental — une plateforme réellement soignée, pensée pour la façon dont les apprenants africains se connectent réellement : monnaie locale, systèmes d'examen locaux, des tuteurs en qui votre famille peut avoir confiance, et un produit qui fonctionne même avec une connexion lente.",
    'landing.finalCta.title': 'Prêt à commencer ?',
    'landing.finalCta.body':
      "Inscrivez-vous gratuitement — parcourez les cours en tant qu'invité, ou créez un compte pour sauvegarder votre progression, réserver des tuteurs et obtenir des certificats.",
    'landing.finalCta.button': 'Créer un compte gratuit',

    'footer.becomeInstructor': 'Devenir instructeur',
    'footer.columns.learners.title': 'Pour les apprenants',
    'footer.columns.learners.browse': 'Parcourir les cours',
    'footer.columns.learners.findTutor': 'Trouver un tuteur',
    'footer.columns.learners.certificates': 'Mes certificats',
    'footer.columns.educators.title': 'Pour les éducateurs',
    'footer.columns.organizations.title': 'Pour les organisations',
    'footer.disclaimer':
      'S@Learn met en relation des apprenants avec des instructeurs et tuteurs indépendants. Le contenu des cours et la disponibilité des tuteurs sont fournis par chaque instructeur ; le statut de vérification est affiché lorsqu\'il est disponible.',
    'footer.copyrightSuffix': 'S@Learn — Store of Learning. Conçu à Douala, Cameroun.',

    'courses.explore': 'Explorer les cours',
    'courses.allCategories': 'Toutes les catégories',
    'courses.saved': 'Enregistrés',
    'courses.sort.newest': 'Plus récents',
    'courses.sort.priceLow': 'Prix : croissant',
    'courses.sort.priceHigh': 'Prix : décroissant',
    'courses.sort.title': 'Titre A-Z',
    'courses.sortAria': 'Trier les cours',
    'courses.loadingCourses': 'Chargement des cours...',
    'courses.noSaved': "Vous n'avez encore enregistré aucun cours",
    'courses.noneFound': 'Aucun cours trouvé',
    'courses.loadMore': 'Charger plus',
    'courses.remaining': 'restants',
    'courses.removeSaved': 'Retirer des cours enregistrés',
    'courses.saveForLater': 'Enregistrer pour plus tard',
    'courses.verifiedInstructor': 'Instructeur vérifié',
    'courses.lessons': 'leçons',
    'courses.level.beginner': 'Débutant',
    'courses.level.intermediate': 'Intermédiaire',
    'courses.level.advanced': 'Avancé',

    'courseDetail.reviewsSuffix': 'avis',
    'courseDetail.openToAllLevels': 'Ouvert à tous niveaux',
    'courseDetail.noLessonsYet': 'Aucune leçon pour le moment',
    'courseDetail.hours': 'heures',
    'courseDetail.about': 'À propos de ce cours',
    'courseDetail.content': 'Contenu du cours',
    'courseDetail.total': 'au total',
    'courseDetail.min': 'min',
    'courseDetail.instructor': 'Instructeur',
    'courseDetail.verified': 'Vérifié',
    'courseDetail.studentReviews': 'Avis des étudiants',
    'courseDetail.paymentReceived': 'Paiement reçu — activation de votre inscription…',
    'courseDetail.checkoutCancelled': "Paiement annulé — vous n'avez pas été débité.",
    'courseDetail.enrolledPrefix': 'Inscrit —',
    'courseDetail.completeSuffix': '% terminé',
    'courseDetail.guestNotice':
      "Navigation en tant qu'invité — votre progression n'est enregistrée que pour cette session.",
    'courseDetail.finalExamReady':
      "Toutes les leçons sont terminées — réussissez l'examen final pour obtenir votre certificat.",
    'courseDetail.takeFinalExam': "Passer l'examen final",
    'courseDetail.continueLearning': "Continuer l'apprentissage",
    'courseDetail.instructorCantEnroll': "Les comptes instructeur ne peuvent pas s'inscrire aux cours",
    'courseDetail.perkOffline': 'Apprenez sur tout appareil, même hors ligne',
    'courseDetail.perkCertificate': 'Certificat de réussite',
    'courseDetail.ofContent': 'de contenu',
    'courseDetail.finalExamRemaining': 'Examen final restant',
    'courseDetail.takeExam': "Passer l'examen",
    'courseDetail.continue': 'Continuer',
    'courseDetail.redirecting': 'Redirection vers le paiement…',
    'courseDetail.enrollPay': "S'inscrire — payer et s'inscrire",
    'courseDetail.enrollNow': "S'inscrire maintenant",
    'courseDetail.startFreeGuest': 'Commencer gratuitement (invité)',
    'courseDetail.signInToEnroll': "Se connecter pour s'inscrire",
    'courseDetail.signInForPaid': 'Veuillez vous connecter pour vous inscrire aux cours payants',
    'courseDetail.checkoutError': 'Impossible de démarrer le paiement. Veuillez réessayer.',
    'courseDetail.enrollError': "Échec de l'inscription au cours",
  },
  en: {
    'nav.home': 'Home',
    'nav.courses': 'Courses',
    'nav.dashboard': 'Dashboard',
    'nav.tutors': 'Find a Tutor',
    'nav.audience.individual': 'Individuals',
    'nav.audience.schools': 'Schools & Universities',
    'nav.audience.business': 'Business',
    'nav.audience.government': 'Government',
    'nav.reviewQueue': 'Review queue',
    'nav.accountSettings': 'Account settings',
    'nav.signIn': 'Sign In',
    'nav.signOut': 'Sign Out',
    'nav.openMenu': 'Open menu',
    'nav.closeMenu': 'Close menu',
    'guest.xpLabel': 'guest XP (this session)',

    'common.builtForLearners': 'Built for African learners',
    'common.trust.courses': 'courses',
    'common.trust.learners': 'learners',
    'common.trust.instructors': 'expert instructors',
    'common.trust.lowData': 'Low-data friendly',
    'common.searchPlaceholder': 'Search courses...',
    'common.searchAria': 'Search courses',
    'common.browseCourses': 'Browse courses',
    'common.free': 'Free',
    'common.loadingEllipsis': 'Loading…',

    'home.hero.title': 'Learn the skills that grow your income',
    'home.hero.subtitle':
      'Practical courses from local experts — build, market and run real projects. Learn at your own pace, on any device, even on a slow connection.',
    'home.hero.search': 'Search',
    'home.hero.topics.web': 'Web development',
    'home.hero.topics.marketing': 'Digital marketing',
    'home.hero.topics.data': 'Data analysis',
    'home.hero.topics.design': 'Design',
    'home.categories.all': 'All',
    'home.featured.eyebrow': 'Most popular',
    'home.featured.title': 'Featured courses',
    'home.featured.viewAll': 'View all',
    'home.featured.empty': 'No courses available yet',
    'home.instructorCta.eyebrow': 'For instructors',
    'home.instructorCta.title': 'Teach what you know. Earn as you grow.',
    'home.instructorCta.body':
      'Publish your first course in an afternoon. We handle hosting, payments and certificates — you focus on your students.',
    'home.instructorCta.button': 'Become an instructor',
    'home.instructorCta.terms': 'Free to start · Keep up to 85% of sales',
    'home.whyChoose.title': 'Why choose S@Learn?',
    'home.whyChoose.pace.title': 'Learn at your own pace',
    'home.whyChoose.pace.body': 'Access courses anytime, anywhere',
    'home.whyChoose.certificates.title': 'Earn certificates',
    'home.whyChoose.certificates.body': 'Get recognized for your achievements',
    'home.whyChoose.experts.title': 'Expert instructors',
    'home.whyChoose.experts.body': 'Learn from industry professionals',

    'landing.hero.title':
      'One platform to learn, teach, and get tutored — built for how you actually connect',
    'landing.hero.subtitle':
      'Practical courses from local experts, a marketplace to book verified tutors, and certificates that mean something. Works on any device, even on a slow connection.',
    'landing.hero.getStarted': 'Get started free',
    'landing.whatWeDo.eyebrow': 'What we do',
    'landing.whatWeDo.title': 'Everything to learn and grow',
    'landing.pillars.courses.title': 'Practical courses',
    'landing.pillars.courses.body':
      'Learn real, income-generating skills from local experts — at your own pace, on any device.',
    'landing.pillars.tutors.title': 'Verified tutors',
    'landing.pillars.tutors.body':
      'Book a vetted, identity-checked tutor for your child, matched to your neighborhood and budget.',
    'landing.pillars.certificates.title': 'Real certificates',
    'landing.pillars.certificates.body':
      'Finish a course, pass the final exam, and earn a certificate that proves what you actually learned.',
    'landing.testimonials.eyebrow': 'From real students',
    'landing.testimonials.title': 'What learners are saying',
    'landing.vision.eyebrow': 'Our vision',
    'landing.vision.title': 'World-class, built for us',
    'landing.vision.body':
      'Not a stripped-down version of a Western product — a genuinely polished platform designed around how African learners actually connect: local currency, local exam systems, tutors your family can trust, and a product that works even on a slow connection.',
    'landing.finalCta.title': 'Ready to get started?',
    'landing.finalCta.body':
      'Join for free — browse courses as a guest, or create an account to save progress, book tutors, and earn certificates.',
    'landing.finalCta.button': 'Create free account',

    'footer.becomeInstructor': 'Become an Instructor',
    'footer.columns.learners.title': 'For Learners',
    'footer.columns.learners.browse': 'Browse courses',
    'footer.columns.learners.findTutor': 'Find a tutor',
    'footer.columns.learners.certificates': 'My certificates',
    'footer.columns.educators.title': 'For Educators',
    'footer.columns.organizations.title': 'For Organizations',
    'footer.disclaimer':
      'S@Learn connects learners with independent instructors and tutors. Course content and tutor availability are provided by individual instructors; verification status is shown where available.',
    'footer.copyrightSuffix': 'S@Learn — Store of Learning. Built in Douala, Cameroon.',

    'courses.explore': 'Explore courses',
    'courses.allCategories': 'All categories',
    'courses.saved': 'Saved',
    'courses.sort.newest': 'Newest',
    'courses.sort.priceLow': 'Price: low to high',
    'courses.sort.priceHigh': 'Price: high to low',
    'courses.sort.title': 'Title A-Z',
    'courses.sortAria': 'Sort courses',
    'courses.loadingCourses': 'Loading courses...',
    'courses.noSaved': "You haven't saved any courses yet",
    'courses.noneFound': 'No courses found',
    'courses.loadMore': 'Load more',
    'courses.remaining': 'remaining',
    'courses.removeSaved': 'Remove from saved courses',
    'courses.saveForLater': 'Save course for later',
    'courses.verifiedInstructor': 'Verified instructor',
    'courses.lessons': 'lessons',
    'courses.level.beginner': 'Beginner',
    'courses.level.intermediate': 'Intermediate',
    'courses.level.advanced': 'Advanced',

    'courseDetail.reviewsSuffix': 'reviews',
    'courseDetail.openToAllLevels': 'Open to all levels',
    'courseDetail.noLessonsYet': 'No lessons yet',
    'courseDetail.hours': 'hours',
    'courseDetail.about': 'About this course',
    'courseDetail.content': 'Course content',
    'courseDetail.total': 'total',
    'courseDetail.min': 'min',
    'courseDetail.instructor': 'Instructor',
    'courseDetail.verified': 'Verified',
    'courseDetail.studentReviews': 'Student reviews',
    'courseDetail.paymentReceived': 'Payment received — activating your enrollment…',
    'courseDetail.checkoutCancelled': 'Checkout cancelled — you have not been charged.',
    'courseDetail.enrolledPrefix': 'Enrolled —',
    'courseDetail.completeSuffix': '% complete',
    'courseDetail.guestNotice': 'Browsing as guest — your progress is only saved for this session.',
    'courseDetail.finalExamReady': 'All lessons complete — pass the final exam to earn your certificate.',
    'courseDetail.takeFinalExam': 'Take final exam',
    'courseDetail.continueLearning': 'Continue learning',
    'courseDetail.instructorCantEnroll': "Instructor accounts can't enroll in courses",
    'courseDetail.perkOffline': 'Learn on any device, offline-friendly',
    'courseDetail.perkCertificate': 'Certificate of completion',
    'courseDetail.ofContent': 'of content',
    'courseDetail.finalExamRemaining': 'Final exam remaining',
    'courseDetail.takeExam': 'Take exam',
    'courseDetail.continue': 'Continue',
    'courseDetail.redirecting': 'Redirecting to checkout…',
    'courseDetail.enrollPay': 'Enroll now — pay & enroll',
    'courseDetail.enrollNow': 'Enroll now',
    'courseDetail.startFreeGuest': 'Start free (guest)',
    'courseDetail.signInToEnroll': 'Sign in to enroll',
    'courseDetail.signInForPaid': 'Please sign in to enroll in paid courses',
    'courseDetail.checkoutError': 'Could not start checkout. Please try again.',
    'courseDetail.enrollError': 'Failed to enroll in course',
  },
} as const;

export type TranslationKey = keyof (typeof translations)['fr'];

// Design Review D10: detect from browser/device locale, fallback to French
// -- matches the real Cameroon linguistic mix (Scope Decision #4), no
// onboarding question forced on the user.
export function detectDefaultLocale(): Locale {
  if (typeof navigator === 'undefined') return 'fr';
  const lang = navigator.language?.toLowerCase() ?? '';
  return lang.startsWith('en') ? 'en' : 'fr';
}

export function loadStoredLocale(): Locale | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === 'fr' || stored === 'en' ? stored : null;
}

export function storeLocale(locale: Locale): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function translate(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}
