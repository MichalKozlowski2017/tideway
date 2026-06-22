import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { LegalProse, LegalSection } from "@/components/legal-prose";
import { PageHeader } from "@/components/page-header";
import { aboutPath, privacyPath, ui } from "@/lib/i18n/config";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `O nas | ${SITE_NAME}`,
  description:
    "Czym jest Tideway, skąd bierzemy treści i jak działają automatyczne streszczenia.",
};

export default function AboutPage() {
  const locale = "pl" as const;
  const t = ui[locale];

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <PageHeader
          title={t.aboutPage}
          description="Serwis trendów oparty na publicznych źródłach i streszczeniach przygotowanych przez AI."
        />

        <LegalProse>
          <LegalSection title="Czym jest Tideway?">
            <p>
              {SITE_NAME} zbiera tematy z publicznych kanałów — m.in. kanałów RSS,
              Hacker News i Lobsters — i przygotowuje z nich krótkie artykuły po
              polsku. Celem jest szybki przegląd tego, co dziś grzeje w sieci, bez
              przewijania dziesiątek linków.
            </p>
          </LegalSection>

          <LegalSection title="Jak powstają artykuły?">
            <p>
              Treści na stronie są <strong>generowane automatycznie</strong> na
              podstawie tytułów, opisów i metadanych ze źródeł zewnętrznych.
              Streszczenia tworzy model językowy (OpenAI). Nie kopiujemy w całości
              artykułów innych wydawców — każdy wpis zawiera link do oryginału w
              sekcji „Źródła”.
            </p>
            <p>
              Automatyczne treści mogą zawierać błędy, nieścisłości lub
              uproszczenia. Zawsze warto zajrzeć do źródła, zanim podejmiesz
              decyzję na podstawie informacji z Tideway.
            </p>
          </LegalSection>

          <LegalSection title="Źródła i prawa autorskie">
            <p>
              Szanujemy prawa wydawców. Każdy artykuł wskazuje źródło, z którego
              wyszedł temat. Obrazki mogą pochodzić z kanału RSS, metadanych
              strony źródłowej lub banków zdjęć (np. Unsplash) jako materiał
              zastępczy.
            </p>
            <p>
              Jeśli jesteś właścicielem treści i uważasz, że coś narusza Twoje
              prawa, napisz na{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-blue-600 hover:text-blue-800"
              >
                {CONTACT_EMAIL}
              </a>
              . Usuniemy lub poprawimy wpis po weryfikacji.
            </p>
          </LegalSection>

          <LegalSection title="Kontakt">
            <p>
              Pytania, zgłoszenia błędów i sprawy prawne:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-blue-600 hover:text-blue-800"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <p>
              Więcej o przetwarzaniu danych:{" "}
              <Link
                href={privacyPath(locale)}
                className="text-blue-600 hover:text-blue-800"
              >
                {t.privacyPage}
              </Link>
            </p>
          </LegalSection>
        </LegalProse>
      </main>
    </>
  );
}
