// Zip prefix (first 3 digits) → region key
// Covers ~500 major metro prefix ranges across all US tiers
const ZIP_PREFIX_MAP = {
  // ── US TIER 1, Major Metro ────────────────────────────────
  // New York City + metro
  '100':'us-tier1','101':'us-tier1','102':'us-tier1','103':'us-tier1','104':'us-tier1',
  '105':'us-tier1','106':'us-tier1','107':'us-tier1','108':'us-tier1','109':'us-tier1',
  '110':'us-tier1','111':'us-tier1','112':'us-tier1','113':'us-tier1','114':'us-tier1',
  '116':'us-tier1',
  // NJ suburbs (NYC metro)
  '070':'us-tier1','071':'us-tier1','072':'us-tier1','073':'us-tier1','074':'us-tier1',
  '075':'us-tier1','076':'us-tier1','077':'us-tier1','078':'us-tier1','079':'us-tier1',
  // Los Angeles + metro
  '900':'us-tier1','901':'us-tier1','902':'us-tier1','903':'us-tier1','904':'us-tier1',
  '905':'us-tier1','906':'us-tier1','907':'us-tier1','908':'us-tier1','910':'us-tier1',
  '911':'us-tier1','912':'us-tier1','913':'us-tier1','914':'us-tier1','915':'us-tier1',
  '916':'us-tier1','917':'us-tier1','918':'us-tier1',
  // San Francisco / Bay Area
  '940':'us-tier1','941':'us-tier1','942':'us-tier1','943':'us-tier1','944':'us-tier1',
  '945':'us-tier1','946':'us-tier1','947':'us-tier1','948':'us-tier1','949':'us-tier1',
  '950':'us-tier1','951':'us-tier1','952':'us-tier1','953':'us-tier1','954':'us-tier1',
  // Chicago metro
  '606':'us-tier1','607':'us-tier1','608':'us-tier1','609':'us-tier1',
  '600':'us-tier1','601':'us-tier1','602':'us-tier1','603':'us-tier1','604':'us-tier1','605':'us-tier1',
  // Miami / Ft. Lauderdale
  '330':'us-tier1','331':'us-tier1','332':'us-tier1','333':'us-tier1','334':'us-tier1',
  '335':'us-tier1','336':'us-tier1','337':'us-tier1','338':'us-tier1',
  // Boston
  '020':'us-tier1','021':'us-tier1','022':'us-tier1','023':'us-tier1','024':'us-tier1',
  '025':'us-tier1','026':'us-tier1','027':'us-tier1',
  // Washington DC metro
  '200':'us-tier1','201':'us-tier1','202':'us-tier1','203':'us-tier1','204':'us-tier1','205':'us-tier1',
  '206':'us-tier1','207':'us-tier1','208':'us-tier1','209':'us-tier1',
  // Northern Virginia (DC metro)
  '220':'us-tier1','221':'us-tier1','222':'us-tier1','223':'us-tier1',
  // Seattle
  '980':'us-tier1','981':'us-tier1','982':'us-tier1','983':'us-tier1','984':'us-tier1',

  // ── US TIER 2, Mid-Market ────────────────────────────────
  // Phoenix / Scottsdale
  '850':'us-tier2','851':'us-tier2','852':'us-tier2','853':'us-tier2','854':'us-tier2','855':'us-tier2',
  // Dallas / Fort Worth
  '750':'us-tier2','751':'us-tier2','752':'us-tier2','753':'us-tier2','754':'us-tier2',
  '755':'us-tier2','756':'us-tier2','757':'us-tier2','758':'us-tier2','759':'us-tier2',
  '760':'us-tier2','761':'us-tier2','762':'us-tier2','763':'us-tier2','764':'us-tier2',
  '765':'us-tier2','766':'us-tier2','767':'us-tier2',
  // Atlanta
  '300':'us-tier2','301':'us-tier2','302':'us-tier2','303':'us-tier2','304':'us-tier2',
  '305':'us-tier2','306':'us-tier2','307':'us-tier2','308':'us-tier2','309':'us-tier2',
  // Denver / Boulder
  '800':'us-tier2','801':'us-tier2','802':'us-tier2','803':'us-tier2','804':'us-tier2',
  '805':'us-tier2','806':'us-tier2','807':'us-tier2','808':'us-tier2','809':'us-tier2',
  // Nashville
  '370':'us-tier2','371':'us-tier2','372':'us-tier2','373':'us-tier2','374':'us-tier2',
  // Austin
  '786':'us-tier2','787':'us-tier2','788':'us-tier2',
  // Portland OR
  '970':'us-tier2','971':'us-tier2','972':'us-tier2','973':'us-tier2','974':'us-tier2',
  // San Antonio
  '780':'us-tier2','781':'us-tier2','782':'us-tier2','783':'us-tier2','784':'us-tier2',
  // Charlotte
  '280':'us-tier2','281':'us-tier2','282':'us-tier2','283':'us-tier2','284':'us-tier2',
  // Minneapolis
  '553':'us-tier2','554':'us-tier2','555':'us-tier2','556':'us-tier2','557':'us-tier2',
  // Houston
  '770':'us-tier2','771':'us-tier2','772':'us-tier2','773':'us-tier2','774':'us-tier2',
  '775':'us-tier2','776':'us-tier2','777':'us-tier2',
  // Las Vegas
  '889':'us-tier2','890':'us-tier2','891':'us-tier2',
  // Sacramento
  '956':'us-tier2','957':'us-tier2','958':'us-tier2',
  // San Diego
  '919':'us-tier2','920':'us-tier2','921':'us-tier2','922':'us-tier2',
  // Baltimore
  '210':'us-tier2','211':'us-tier2','212':'us-tier2',
  // Philadelphia
  '190':'us-tier2','191':'us-tier2','192':'us-tier2','193':'us-tier2','194':'us-tier2',
  // Pittsburgh
  '150':'us-tier2','151':'us-tier2','152':'us-tier2',
  // St. Louis
  '630':'us-tier2','631':'us-tier2','632':'us-tier2','633':'us-tier2',
  // Indianapolis
  '460':'us-tier2','461':'us-tier2','462':'us-tier2',
  // Columbus OH
  '430':'us-tier2','431':'us-tier2','432':'us-tier2','433':'us-tier2',
  // Kansas City
  '640':'us-tier2','641':'us-tier2','642':'us-tier2',
  // Cincinnati
  '450':'us-tier2','451':'us-tier2','452':'us-tier2',
  // Cleveland
  '440':'us-tier2','441':'us-tier2','442':'us-tier2','443':'us-tier2','444':'us-tier2',
  // Tampa / St. Pete
  '335':'us-tier2','336':'us-tier2','337':'us-tier2',
  // Orlando
  '327':'us-tier2','328':'us-tier2','329':'us-tier2','326':'us-tier2',
  // Richmond VA
  '230':'us-tier2','231':'us-tier2','232':'us-tier2',
  // Salt Lake City
  '840':'us-tier2','841':'us-tier2','842':'us-tier2','843':'us-tier2',
  // Albuquerque
  '870':'us-tier2','871':'us-tier2',

  // ── US TIER 3, Smaller Markets ──────────────────────────
  // Tucson
  '856':'us-tier3','857':'us-tier3',
  // Boise
  '836':'us-tier3','837':'us-tier3','838':'us-tier3',
  // Des Moines
  '500':'us-tier3','501':'us-tier3','502':'us-tier3','503':'us-tier3',
  // Raleigh / Durham
  '275':'us-tier3','276':'us-tier3','277':'us-tier3','278':'us-tier3',
  // Omaha
  '680':'us-tier3','681':'us-tier3',
  // Spokane
  '990':'us-tier3','991':'us-tier3','992':'us-tier3',
  // Fresno
  '936':'us-tier3','937':'us-tier3',
  // Bakersfield
  '932':'us-tier3','933':'us-tier3',
  // Little Rock
  '720':'us-tier3','721':'us-tier3','722':'us-tier3',
  // Tulsa
  '740':'us-tier3','741':'us-tier3',
  // Oklahoma City
  '730':'us-tier3','731':'us-tier3','732':'us-tier3','733':'us-tier3',
  // El Paso
  '799':'us-tier3',
  // Corpus Christi
  '783':'us-tier3','784':'us-tier3',
  // Wichita
  '670':'us-tier3','671':'us-tier3','672':'us-tier3',
  // Lubbock
  '793':'us-tier3','794':'us-tier3',
  // Shreveport
  '710':'us-tier3','711':'us-tier3',
  // Jackson MS
  '390':'us-tier3','391':'us-tier3','392':'us-tier3',
  // Montgomery AL
  '360':'us-tier3','361':'us-tier3',
  // Huntsville AL
  '357':'us-tier3','358':'us-tier3',
  // Knoxville
  '376':'us-tier3','377':'us-tier3','378':'us-tier3',
  // Chattanooga
  '374':'us-tier3',
  // Lexington KY
  '405':'us-tier3','406':'us-tier3',
  // Louisville KY
  '400':'us-tier3','401':'us-tier3','402':'us-tier3',
  // Green Bay
  '541':'us-tier3','542':'us-tier3','543':'us-tier3',
  // Madison WI
  '537':'us-tier3','538':'us-tier3',
  // Springfield MO
  '656':'us-tier3','657':'us-tier3',
  // Fargo ND
  '580':'us-tier3','581':'us-tier3',
  // Sioux Falls SD
  '570':'us-tier3','571':'us-tier3',
  // Bismarck ND
  '585':'us-tier3',
  // Cheyenne WY
  '820':'us-tier3',
  // Casper WY
  '826':'us-tier3',
  // Billings MT
  '590':'us-tier3','591':'us-tier3',
  // Great Falls MT
  '594':'us-tier3',
  // Idaho Falls
  '834':'us-tier3','835':'us-tier3',
  // Provo UT
  '846':'us-tier3',
  // Flagstaff AZ
  '860':'us-tier3','861':'us-tier3',
  // Santa Fe NM
  '875':'us-tier3',
};

export function zipToRegion(zip) {
  if (!zip || zip.length < 3) return null;
  const prefix = zip.toString().slice(0, 3);
  return ZIP_PREFIX_MAP[prefix] || null;
}

export function zipToCity(zip) {
  const CITY_NAMES = {
    // Tier 1
    '100':'New York, NY','101':'New York, NY','102':'New York, NY','103':'Staten Island, NY',
    '104':'Bronx, NY','106':'Yonkers, NY','107':'Westchester, NY','110':'Queens, NY',
    '111':'Jamaica, NY','112':'Brooklyn, NY',
    '070':'Newark, NJ','071':'Newark, NJ','072':'Elizabeth, NJ',
    '900':'Los Angeles, CA','901':'Pasadena, CA','902':'Beverly Hills, CA',
    '903':'Inglewood, CA','904':'Santa Monica, CA','910':'Van Nuys, CA',
    '911':'Long Beach, CA','940':'San Francisco, CA','941':'San Francisco, CA',
    '943':'Palo Alto, CA','944':'Oakland, CA','945':'Berkeley, CA',
    '949':'Irvine, CA','950':'San Jose, CA',
    '606':'Chicago, IL','607':'Chicago, IL','608':'Chicago, IL',
    '330':'Miami, FL','331':'Miami, FL','332':'Miami, FL','333':'Fort Lauderdale, FL',
    '020':'Boston, MA','021':'Boston, MA','022':'Cambridge, MA',
    '200':'Washington, DC','202':'Washington, DC',
    '220':'Arlington, VA','221':'Alexandria, VA',
    '980':'Seattle, WA','981':'Seattle, WA',
    // Tier 2
    '850':'Phoenix, AZ','851':'Scottsdale, AZ','852':'Tempe, AZ','853':'Mesa, AZ',
    '750':'Dallas, TX','751':'Dallas, TX','752':'Dallas, TX',
    '760':'Fort Worth, TX','761':'Fort Worth, TX',
    '300':'Atlanta, GA','301':'Atlanta, GA','303':'Atlanta, GA',
    '800':'Denver, CO','801':'Denver, CO','802':'Boulder, CO',
    '370':'Nashville, TN','371':'Nashville, TN',
    '787':'Austin, TX','786':'Austin, TX',
    '972':'Portland, OR','973':'Portland, OR',
    '770':'Houston, TX','771':'Houston, TX',
    '889':'Las Vegas, NV','890':'Las Vegas, NV',
    '280':'Charlotte, NC','281':'Charlotte, NC',
    '190':'Philadelphia, PA','191':'Philadelphia, PA',
    '210':'Baltimore, MD','211':'Baltimore, MD',
    '840':'Salt Lake City, UT','841':'Salt Lake City, UT',
    '870':'Albuquerque, NM',
    '430':'Columbus, OH','431':'Columbus, OH',
    '440':'Cleveland, OH','441':'Cleveland, OH',
    '460':'Indianapolis, IN','461':'Indianapolis, IN',
    '640':'Kansas City, MO','641':'Kansas City, MO',
    '150':'Pittsburgh, PA','151':'Pittsburgh, PA',
    '553':'Minneapolis, MN','554':'Minneapolis, MN',
    '630':'St. Louis, MO','631':'St. Louis, MO',
    '780':'San Antonio, TX','781':'San Antonio, TX',
    // Tier 3
    '856':'Tucson, AZ','857':'Tucson, AZ',
    '836':'Boise, ID','837':'Boise, ID',
    '500':'Des Moines, IA','501':'Des Moines, IA',
    '275':'Raleigh, NC','276':'Durham, NC','277':'Chapel Hill, NC',
    '680':'Omaha, NE','681':'Omaha, NE',
    '740':'Tulsa, OK','741':'Tulsa, OK',
    '730':'Oklahoma City, OK','731':'Oklahoma City, OK',
    '376':'Knoxville, TN','377':'Knoxville, TN',
    '400':'Louisville, KY','401':'Louisville, KY',
    '537':'Madison, WI','538':'Madison, WI',
    '670':'Wichita, KS','671':'Wichita, KS',
    '590':'Billings, MT','591':'Billings, MT',
  };
  if (!zip || zip.length < 3) return null;
  const prefix = zip.toString().slice(0, 3);
  return CITY_NAMES[prefix] || null;
}
