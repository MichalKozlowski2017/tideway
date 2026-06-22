import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { LegalProse, LegalSection } from "@/components/legal-prose";
import { PageHeader } from "@/components/page-header";
import { aboutPath, ui } from "@/lib/i18n/config";
import { CONTACT_EMAIL, PRIMARY_SITE_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Polityka prywatności | ${SITE_NAME}`,
  description:
    "Informacje o przetwarzaniu danych osobowych, analityce i plikach cookie w serwisie Tideway.",
};

const LAST_UPDATED = "21 czerwca 2026";

export default function PrivacyPage() {
  const locale = "pl" as const;
  const t = ui[locale];

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <PageHeader
          title={t.privacyPage}
          description={`Ostatnia aktualizacja: ${LAST_UPDATED}`}
        />

        <LegalProse>
          <LegalSection title="1. Administrator danych">
            <p>
              Administratorem serwisu {SITE_NAME} ({PRIMARY_SITE_URL}) jest
              właściciel projektu Tideway. W sprawach prywatności pisz na:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-blue-600 hover:text-blue-800"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </LegalSection>

          <LegalSection title="2. Jakie dane zbieramy?">
            <p>
              Serwis nie wymaga rejestracji ani logowania. Nie zbieramy
              świadomie danych takich jak imię, adres czy numer telefonu.
            </p>
            <p>Przy korzystaniu ze strony mogą być przetwarzane:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Dane techniczne</strong> — adres IP, typ przeglądarki,
                system operacyjny, odwiedzane podstrony (logi serwera
                hostingowego).
              </li>
              <li>
                <strong>Dane analityczne</strong> — anonimowe statystyki
                odwiedzin przez Vercel Analytics (np. liczba wyświetleń,
                kraj, urządzenie).
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="3. Cele i podstawy prawne (RODO)">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Udostępnienie serwisu</strong> — art. 6 ust. 1 lit. f
                RODO (prawnie uzasadniony interes: utrzymanie działania
                strony).
              </li>
              <li>
                <strong>Analityka ruchu</strong> — art. 6 ust. 1 lit. f RODO
                (interes w poznaniu, jak użytkownicy korzystają z serwisu, w
                celu jego ulepszania).
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="4. Vercel Analytics">
            <p>
              Korzystamy z Vercel Analytics do mierzenia ruchu na stronie.
              Narzędzie nie używa plików cookie w rozumieniu klasycznych
              trackerów reklamowych i nie profiluje użytkowników w celach
              marketingowych. Więcej:{" "}
              <a
                href="https://vercel.com/docs/analytics/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                polityka prywatności Vercel
              </a>
              .
            </p>
          </LegalSection>

          <LegalSection title="5. Hosting i baza danych">
            <p>
              Strona jest hostowana na Vercel (USA/UE). Dane treści (artykuły,
              źródła) przechowujemy w Supabase (PostgreSQL). Dostawcy mogą
              przetwarzać dane poza EOG — stosują standardowe mechanizmy
              ochrony (m.in. klauzule umowne).
            </p>
          </LegalSection>

          <LegalSection title="6. Okres przechowywania">
            <p>
              Logi serwera — zgodnie z polityką hostingu (zwykle kilka dni do
              kilku tygodni). Dane analityczne — w formie zagregowanej, przez
              okres wynikający z ustawień narzędzia analitycznego.
            </p>
          </LegalSection>

          <LegalSection title="7. Twoje prawa">
            <p>
              Przysługuje Ci prawo dostępu do danych, sprostowania, usunięcia,
              ograniczenia przetwarzania, sprzeciwu oraz skargi do Prezesa UODO
              ({""}
              <a
                href="https://uodo.gov.pl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                uodo.gov.pl
              </a>
              ). Napisz na {CONTACT_EMAIL}, jeśli chcesz skorzystać z praw.
            </p>
          </LegalSection>

          <LegalSection title="8. Pliki cookie">
            <p>
              Tideway nie stosuje własnych plików cookie marketingowych. Vercel
              Analytics działa bez klasycznych cookies trackingowych. Jeśli w
              przyszłości dodamy reklamy lub inne narzędzia wymagające zgody,
              zaktualizujemy tę politykę i dodamy baner zgody.
            </p>
          </LegalSection>

          <LegalSection title="9. Zmiany">
            <p>
              Politykę możemy aktualizować. Nowa wersja będzie publikowana na
              tej stronie z datą aktualizacji. Więcej o serwisie:{" "}
              <Link
                href={aboutPath(locale)}
                className="text-blue-600 hover:text-blue-800"
              >
                {t.aboutPage}
              </Link>
              .
            </p>
          </LegalSection>
        </LegalProse>
      </main>
    </>
  );
}
