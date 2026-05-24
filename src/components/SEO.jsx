import { Helmet } from 'react-helmet-async';

const SITE_NAME    = 'CreatorBridge';
const SITE_URL     = 'https://www.creatorbridge.studio';
const DEFAULT_DESC = 'CreatorBridge connects brands with verified freelance video, podcast, event, and media creators. Secure payments. Vetted talent. Phoenix, AZ.';
const DEFAULT_IMG  = `${SITE_URL}/images/og-default.jpg`;

/**
 * SEO — drop this at the top of any page's JSX.
 *
 * Props:
 *   title       Short page title (site name appended automatically)
 *   description Meta description (falls back to platform default)
 *   image       Absolute URL for og:image (falls back to default OG image)
 *   url         Canonical URL for this page (falls back to site root)
 *   jsonLd      Optional plain object for JSON-LD structured data
 */
export function SEO({ title, description, image, url, jsonLd }) {
  const fullTitle    = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const metaDesc     = description || DEFAULT_DESC;
  const metaImage    = image       || DEFAULT_IMG;
  const canonicalUrl = url         || SITE_URL;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDesc} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:site_name"   content={SITE_NAME}    />
      <meta property="og:type"        content="website"       />
      <meta property="og:title"       content={fullTitle}     />
      <meta property="og:description" content={metaDesc}      />
      <meta property="og:image"       content={metaImage}     />
      <meta property="og:url"         content={canonicalUrl}  />

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle}           />
      <meta name="twitter:description" content={metaDesc}            />
      <meta name="twitter:image"       content={metaImage}           />

      {/* JSON-LD structured data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
