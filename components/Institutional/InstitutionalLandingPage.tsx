import { useState } from 'react';
import { useLocale } from '../../contexts/LocaleContext';
import { InstitutionalAccountType } from '../../lib/supabase';
import { submitInstitutionalInquiry } from '../../lib/institutionalInquiries';

type InstitutionalLandingPageProps = {
  accountType: InstitutionalAccountType;
};

type Content = {
  eyebrow: string;
  title: string;
  subtitle: string;
  valueProps: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  formTitle: string;
  formIntro: string;
};

// DESIGN.md "Patterns" (2026-07-23): one institutional page structure
// (value props -> FAQ incl. compliance -> inquiry form), same content shape
// per audience so it's one component, not three near-duplicate files. Copy
// is deliberately honest about what's live today -- these are new,
// interest-capture tracks (see 0035_institutional_inquiries.sql), not a
// claim that SSO/analytics/etc. already exist.
const CONTENT: Record<InstitutionalAccountType, { fr: Content; en: Content }> = {
  school_university: {
    fr: {
      eyebrow: 'Pour les écoles & universités',
      title: "Donnez à vos étudiants accès aux tuteurs vérifiés de S@Learn",
      subtitle:
        "Un catalogue de cours et un réseau de tuteurs vérifiés, adaptés aux systèmes d'examen que vos étudiants passent réellement.",
      valueProps: [
        {
          title: 'Des tuteurs vérifiés pour vous',
          body: "Chaque tuteur passe la même vérification d'identité et de compétences que votre établissement devrait organiser lui-même.",
        },
        {
          title: 'Adapté aux vrais examens locaux',
          body: 'Cours et corrigés vérifiés correspondent aux systèmes que vos étudiants passent (GCE, BEPC, concours universitaires).',
        },
        {
          title: 'Un seul point de contact',
          body: 'Un interlocuteur unique pour l’intégration, la facturation et le support, plutôt que chaque étudiant seul.',
        },
      ],
      faq: [
        {
          q: 'Est-ce que ça remplace notre LMS actuel ?',
          a: "Non -- S@Learn vient en complément de ce que vous utilisez déjà. Ce n'est pas un remplacement, c'est un accès à des tuteurs vérifiés et à des contenus d'examen.",
        },
        {
          q: 'Comment les données des étudiants sont-elles gérées ?',
          a: 'Nous mettons en place des accords institutionnels au cas par cas. Parlez-nous de votre établissement ci-dessous et nous verrons ce qui s’applique à vous.',
        },
        {
          q: 'Quel est le coût ?',
          a: 'Ça dépend du nombre d’étudiants et de vos besoins -- contactez-nous et nous établirons une offre ensemble.',
        },
      ],
      formTitle: 'Parlez-nous de votre établissement',
      formIntro: 'Nous revenons vers vous pour discuter de ce qui conviendrait à vos étudiants.',
    },
    en: {
      eyebrow: 'For Schools & Universities',
      title: "Bring S@Learn's verified tutor network to your students",
      subtitle:
        "A course catalog and verified tutor network, mapped to the exam systems your students actually sit.",
      valueProps: [
        {
          title: 'Verified tutors, vetted for you',
          body: 'Every tutor passes the same identity and subject-matter verification your institution would otherwise have to run itself.',
        },
        {
          title: 'Built for real local exam systems',
          body: 'Courses and verified past-paper solutions map to the exam systems your students actually sit (GCE, BEPC, university entrance).',
        },
        {
          title: 'A single point of contact',
          body: 'One institutional contact for onboarding, billing, and support instead of students navigating individually.',
        },
      ],
      faq: [
        {
          q: 'Is this a full LMS replacement?',
          a: "No -- S@Learn runs alongside what you already use. Think of it as bringing verified tutors and exam-prep content to your students, not replacing your school's systems.",
        },
        {
          q: 'How is student data handled?',
          a: "We're setting up institutional agreements case by case. Tell us about your institution below and we'll walk through what applies to you.",
        },
        {
          q: 'What does it cost?',
          a: "Pricing depends on your student count and what you need -- reach out and we'll work out a plan together.",
        },
      ],
      formTitle: 'Tell us about your institution',
      formIntro: "We'll get back to you to talk through what would work for your students.",
    },
  },
  business: {
    fr: {
      eyebrow: 'Pour les entreprises',
      title: 'Donnez à votre équipe accès à des tuteurs et cours vérifiés',
      subtitle: 'Soutenez la formation continue de vos employés avec le catalogue et le réseau de tuteurs de S@Learn.',
      valueProps: [
        { title: 'Formation continue simplifiée', body: 'Un catalogue de cours accessible à toute votre équipe, sans gérer chaque inscription séparément.' },
        { title: 'Instructeurs et tuteurs vérifiés', body: 'Le même processus de vérification que pour les particuliers -- pas de contenu non contrôlé.' },
        { title: 'Un seul contact pour toute l’équipe', body: 'Facturation et support centralisés plutôt que des comptes individuels dispersés.' },
      ],
      faq: [
        { q: 'Combien d’employés faut-il pour commencer ?', a: 'Aucun minimum imposé -- parlez-nous de votre équipe et nous verrons ce qui convient.' },
        { q: 'Peut-on suivre la progression de l’équipe ?', a: 'C’est une des choses que nous mettons en place avec les premiers partenaires -- dites-nous ce dont vous avez besoin.' },
        { q: 'Quel est le coût ?', a: 'Ça dépend de la taille de votre équipe -- contactez-nous pour une offre adaptée.' },
      ],
      formTitle: 'Parlez-nous de votre entreprise',
      formIntro: 'Nous revenons vers vous pour discuter de ce qui conviendrait à votre équipe.',
    },
    en: {
      eyebrow: 'For Business',
      title: 'Give your team access to verified tutors and courses',
      subtitle: "Support your employees' upskilling with S@Learn's course catalog and vetted tutor network.",
      valueProps: [
        { title: 'Upskilling, simplified', body: 'A course catalog available to your whole team without managing every enrollment individually.' },
        { title: 'Verified instructors and tutors', body: 'The same verification process as individual users -- no unchecked content.' },
        { title: 'One contact for the whole team', body: 'Centralized billing and support instead of scattered individual accounts.' },
      ],
      faq: [
        { q: 'Is there a minimum team size?', a: 'No minimum -- tell us about your team and we’ll figure out what fits.' },
        { q: 'Can we track team progress?', a: "That's one of the things we're building out with early partners -- tell us what you need." },
        { q: 'What does it cost?', a: 'It depends on your team size -- reach out and we’ll put together a plan.' },
      ],
      formTitle: 'Tell us about your business',
      formIntro: "We'll get back to you to talk through what would work for your team.",
    },
  },
  government: {
    fr: {
      eyebrow: 'Pour les gouvernements',
      title: "Un partenariat sur l'éducation publique et la formation professionnelle",
      subtitle: "Nous travaillons avec des institutions publiques sur des programmes de formation et l'accès à la préparation aux examens.",
      valueProps: [
        { title: 'Contenu vérifié et localement pertinent', body: "Cours et corrigés adaptés aux systèmes d'examen réels, pas des contenus génériques importés." },
        { title: 'Conçu pour l’échelle', body: 'Pensé pour des programmes à grande échelle, pas seulement des utilisateurs individuels.' },
        { title: 'Un contact dédié au partenariat', body: 'Un interlocuteur unique pour construire un programme adapté à votre initiative.' },
      ],
      faq: [
        { q: 'Quel type de partenariat est possible ?', a: "Ça va de l'accès à la préparation aux examens à des programmes de formation professionnelle plus larges -- parlons de votre initiative." },
        { q: 'Qu’en est-il de la protection des données et de la conformité ?', a: 'Nous prenons cela au sérieux et travaillons les détails au cas par cas pour les partenariats institutionnels -- contactez-nous et nous en discuterons ensemble.' },
        { q: 'Comment démarrer ?', a: 'Remplissez le formulaire ci-dessous avec les détails de votre initiative et nous vous recontacterons.' },
      ],
      formTitle: 'Parlez-nous de votre initiative',
      formIntro: 'Nous revenons vers vous pour discuter d’un partenariat adapté.',
    },
    en: {
      eyebrow: 'For Government',
      title: 'Partner with S@Learn on public education and workforce training',
      subtitle: 'We work with public institutions on training programs and exam-prep access.',
      valueProps: [
        { title: 'Verified, locally-relevant content', body: 'Courses and verified solutions mapped to real exam systems, not generic imported content.' },
        { title: 'Built for scale', body: 'Designed for large-scale programs, not just individual users.' },
        { title: 'A dedicated partnership contact', body: 'One point of contact to shape a program that fits your initiative.' },
      ],
      faq: [
        { q: 'What kind of partnership is possible?', a: "Anything from exam-prep access to broader workforce training programs -- let's talk about your initiative." },
        { q: 'What about data protection and compliance?', a: "We take this seriously and are working through the specifics case by case for institutional partnerships -- reach out and we'll walk through it together." },
        { q: 'How do we get started?', a: 'Fill in the form below with details about your initiative and we’ll get back to you.' },
      ],
      formTitle: 'Tell us about your initiative',
      formIntro: "We'll get back to you to talk through a partnership that fits.",
    },
  },
};

export default function InstitutionalLandingPage({ accountType }: InstitutionalLandingPageProps) {
  const { locale } = useLocale();
  const content = CONTENT[accountType][locale];

  const [organizationName, setOrganizationName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitInstitutionalInquiry({
        accountType,
        organizationName,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        message: message || null,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-paper font-general-sans text-ink">
      <section className="max-w-[1120px] mx-auto px-6 pt-16 pb-12">
        <p className="text-[13px] font-plex-mono uppercase tracking-wide text-oxblood mb-3">{content.eyebrow}</p>
        <h1 className="font-fraunces text-[36px] md:text-[52px] font-medium leading-[1.08] max-w-[820px] mb-5">
          {content.title}
        </h1>
        <p className="text-[16px] text-warm-gray max-w-[560px]">{content.subtitle}</p>
      </section>

      <section className="max-w-[1120px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {content.valueProps.map((vp) => (
            <div key={vp.title} className="bg-white border border-ink-border rounded-lg p-6">
              <h3 className="font-fraunces text-[19px] font-medium mb-2">{vp.title}</h3>
              <p className="text-[14px] text-warm-gray">{vp.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[820px] mx-auto px-6 py-12">
        <h2 className="font-fraunces text-[28px] font-medium mb-6">FAQ</h2>
        <div className="space-y-2">
          {content.faq.map((item) => (
            <details key={item.q} className="border border-ink-border rounded-lg px-4 py-3 group">
              <summary className="cursor-pointer text-[15px] font-medium list-none flex items-center justify-between">
                {item.q}
                <span className="text-warm-gray group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-[14px] text-warm-gray mt-2">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="max-w-[560px] mx-auto px-6 pb-20">
        <div className="bg-white border border-ink-border rounded-xl p-6">
          <h2 className="font-fraunces text-[24px] font-medium mb-2">{content.formTitle}</h2>
          <p className="text-[14px] text-warm-gray mb-6">{content.formIntro}</p>

          {submitted ? (
            <p className="text-[14px] text-forest font-medium" role="status">
              {locale === 'fr' ? 'Merci -- nous vous recontacterons bientôt.' : "Thanks -- we'll be in touch soon."}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium mb-1.5" htmlFor="inst-org-name">
                  {locale === 'fr' ? "Nom de l'organisation" : 'Organization name'}
                </label>
                <input
                  id="inst-org-name"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5" htmlFor="inst-contact-name">
                  {locale === 'fr' ? 'Votre nom' : 'Your name'}
                </label>
                <input
                  id="inst-contact-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5" htmlFor="inst-contact-email">
                  Email
                </label>
                <input
                  id="inst-contact-email"
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5" htmlFor="inst-contact-phone">
                  {locale === 'fr' ? 'Téléphone (optionnel)' : 'Phone (optional)'}
                </label>
                <input
                  id="inst-contact-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm font-plex-mono focus:outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5" htmlFor="inst-message">
                  {locale === 'fr' ? 'Message (optionnel)' : 'Message (optional)'}
                </label>
                <textarea
                  id="inst-message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2.5 border border-ink-border rounded-lg text-sm focus:outline-none focus:border-ink"
                />
              </div>

              {submitError && <p className="text-[13px] text-oxblood font-medium">{submitError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-11 flex items-center justify-center bg-oxblood hover:bg-oxblood-hover disabled:bg-warm-gray-light disabled:text-warm-gray text-white font-semibold text-sm rounded-lg transition-colors"
              >
                {submitting
                  ? locale === 'fr'
                    ? 'Envoi en cours…'
                    : 'Sending…'
                  : locale === 'fr'
                    ? 'Envoyer'
                    : 'Send'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
