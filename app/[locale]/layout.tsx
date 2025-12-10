import { NextIntlClientProvider } from "next-intl"
import { notFound } from "next/navigation"

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "et" }]
}

export default async function LocaleLayout({ children, params: { locale } }) {
  let messages
  try {
    messages = (await import(`../../../messages/${locale}.json`)).default
  } catch (error) {
    notFound()
  }

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
    >
      {children}
    </NextIntlClientProvider>
  )
}