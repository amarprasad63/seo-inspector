export interface TypeDefinition {
  parents: readonly string[];
  properties: Readonly<Record<string, readonly string[]>>;
}

const THING: Readonly<Record<string, readonly string[]>> = {
  name: ['Text'],
  description: ['Text'],
  url: ['URL'],
  image: ['URL', 'ImageObject'],
  identifier: ['Text', 'URL', 'PropertyValue'],
  sameAs: ['URL'],
  alternateName: ['Text'],
  mainEntityOfPage: ['URL', 'CreativeWork'],
  disambiguatingDescription: ['Text'],
  additionalType: ['URL', 'Text'],
  subjectOf: ['CreativeWork'],
};

function createType(
  parents: readonly string[],
  properties: Readonly<Record<string, readonly string[]>>,
): TypeDefinition {
  return { parents, properties };
}

export const VOCABULARY: Record<string, TypeDefinition> = {
  Thing: createType([], THING),
  Intangible: createType(['Thing'], {}),
  StructuredValue: createType(['Intangible'], {}),
  CreativeWork: createType(['Thing'], {
    headline: ['Text'],
    author: ['Person', 'Organization'],
    publisher: ['Organization', 'Person'],
    datePublished: ['Date', 'DateTime'],
    dateModified: ['Date', 'DateTime'],
    thumbnailUrl: ['URL'],
    keywords: ['Text'],
    inLanguage: ['Text', 'Language'],
    isAccessibleForFree: ['Boolean'],
  }),
  Article: createType(['CreativeWork'], {
    articleBody: ['Text'],
    articleSection: ['Text'],
    wordCount: ['Integer'],
  }),
  NewsArticle: createType(['Article'], {}),
  BlogPosting: createType(['Article'], {}),
  WebPage: createType(['CreativeWork'], {
    breadcrumb: ['BreadcrumbList', 'Text'],
    mainEntity: ['Thing'],
    primaryImageOfPage: ['ImageObject'],
    lastReviewed: ['Date', 'DateTime'],
    reviewedBy: ['Person', 'Organization'],
    relatedLink: ['URL'],
    significantLink: ['URL'],
    speakable: ['SpeakableSpecification'],
    specialty: ['Text'],
  }),
  FAQPage: createType(['WebPage'], {
    mainEntity: ['Question'],
  }),
  WebSite: createType(['CreativeWork'], {
    potentialAction: ['Action', 'SearchAction'],
  }),
  Organization: createType(['Thing'], {
    legalName: ['Text'],
    logo: ['URL', 'ImageObject'],
    address: ['PostalAddress', 'Text'],
    telephone: ['Text'],
    email: ['Text'],
    founder: ['Person'],
    foundingDate: ['Date'],
    contactPoint: ['ContactPoint'],
    parentOrganization: ['Organization'],
    subOrganization: ['Organization'],
    employee: ['Person'],
    member: ['Person', 'Organization'],
    location: ['Place', 'PostalAddress', 'Text'],
    areaServed: ['Place', 'AdministrativeArea', 'Text'],
    brand: ['Brand', 'Organization', 'Text'],
    slogan: ['Text'],
    taxID: ['Text'],
    vatID: ['Text'],
    numberOfEmployees: ['QuantitativeValue'],
    knowsAbout: ['Text', 'Thing'],
  }),
  Place: createType(['Thing'], {
    address: ['PostalAddress', 'Text'],
    geo: ['GeoCoordinates'],
    telephone: ['Text'],
    openingHours: ['Text'],
    openingHoursSpecification: ['OpeningHoursSpecification'],
    hasMap: ['URL', 'Map'],
    latitude: ['Number', 'Text'],
    longitude: ['Number', 'Text'],
    containedInPlace: ['Place'],
    containsPlace: ['Place'],
  }),
  LocalBusiness: createType(['Organization', 'Place'], {
    priceRange: ['Text'],
    currenciesAccepted: ['Text'],
    paymentAccepted: ['Text'],
    branchCode: ['Text'],
  }),
  PostalAddress: createType(['StructuredValue'], {
    streetAddress: ['Text'],
    addressLocality: ['Text'],
    addressRegion: ['Text'],
    postalCode: ['Text'],
    addressCountry: ['Text', 'Country'],
    postOfficeBoxNumber: ['Text'],
  }),
  Person: createType(['Thing'], {
    givenName: ['Text'],
    familyName: ['Text'],
    email: ['Text'],
    telephone: ['Text'],
    jobTitle: ['Text'],
    worksFor: ['Organization'],
    affiliation: ['Organization'],
    alumniOf: ['Organization', 'EducationalOrganization'],
    address: ['PostalAddress', 'Text'],
    birthDate: ['Date'],
  }),
  JobPosting: createType(['Intangible'], {
    title: ['Text'],
    datePosted: ['Date', 'DateTime'],
    validThrough: ['Date', 'DateTime'],
    hiringOrganization: ['Organization'],
    jobLocation: ['Place'],
    jobLocationType: ['Text'],
    applicantLocationRequirements: ['AdministrativeArea', 'Country'],
    baseSalary: ['MonetaryAmount', 'Number', 'PriceSpecification'],
    employmentType: ['Text'],
    industry: ['Text'],
    occupationalCategory: ['Text', 'CategoryCode'],
    qualifications: ['Text'],
    responsibilities: ['Text'],
    skills: ['Text'],
    educationRequirements: ['Text', 'EducationalOccupationalCredential'],
    experienceRequirements: ['Text', 'OccupationalExperienceRequirements'],
    incentiveCompensation: ['Text'],
    jobBenefits: ['Text'],
    specialCommitments: ['Text'],
    workHours: ['Text'],
    directApply: ['Boolean'],
    estimatedSalary: ['MonetaryAmount', 'MonetaryAmountDistribution'],
    jobImmediateStart: ['Boolean'],
    jobStartDate: ['Date', 'Text'],
    totalJobOpenings: ['Integer'],
    employmentUnit: ['Organization'],
    relevantOccupation: ['Occupation'],
  }),
  Product: createType(['Thing'], {
    brand: ['Brand', 'Organization', 'Text'],
    sku: ['Text'],
    gtin: ['Text'],
    gtin8: ['Text'],
    gtin12: ['Text'],
    gtin13: ['Text'],
    gtin14: ['Text'],
    mpn: ['Text'],
    offers: ['Offer', 'AggregateOffer'],
    review: ['Review'],
    aggregateRating: ['AggregateRating'],
    category: ['Text', 'Thing', 'CategoryCode'],
    color: ['Text'],
    material: ['Text'],
    manufacturer: ['Organization'],
    model: ['Text', 'ProductModel'],
    productID: ['Text'],
    releaseDate: ['Date'],
    countryOfOrigin: ['Country'],
    itemCondition: ['OfferItemCondition', 'Text'],
    award: ['Text'],
    audience: ['Audience'],
  }),
  Offer: createType(['Intangible'], {
    price: ['Number', 'Text'],
    priceCurrency: ['Text'],
    availability: ['URL', 'Text'],
    priceValidUntil: ['Date'],
    seller: ['Organization', 'Person'],
    itemCondition: ['OfferItemCondition', 'Text'],
    eligibleRegion: ['Place', 'GeoShape', 'Text'],
    validFrom: ['Date', 'DateTime'],
    inventoryLevel: ['QuantitativeValue'],
    offeredBy: ['Organization', 'Person'],
    sku: ['Text'],
    category: ['Text', 'Thing'],
  }),
  AggregateOffer: createType(['Offer'], {
    lowPrice: ['Number', 'Text'],
    highPrice: ['Number', 'Text'],
    offerCount: ['Integer'],
  }),
  Brand: createType(['Intangible'], {
    slogan: ['Text'],
    logo: ['URL', 'ImageObject'],
  }),
  Rating: createType(['Intangible'], {
    ratingValue: ['Number', 'Text'],
    bestRating: ['Number', 'Text'],
    worstRating: ['Number', 'Text'],
  }),
  AggregateRating: createType(['Rating'], {
    reviewCount: ['Integer'],
    ratingCount: ['Integer'],
    itemReviewed: ['Thing'],
  }),
  Review: createType(['CreativeWork'], {
    reviewBody: ['Text'],
    reviewRating: ['Rating', 'AggregateRating'],
    itemReviewed: ['Thing'],
    positiveNotes: ['Text', 'ItemList', 'WebContent'],
    negativeNotes: ['Text', 'ItemList', 'WebContent'],
  }),
  BreadcrumbList: createType(['ItemList'], {}),
  ItemList: createType(['Intangible'], {
    itemListElement: ['ListItem', 'Thing', 'Text'],
    itemListOrder: ['Text', 'ItemListOrderType'],
    numberOfItems: ['Integer'],
  }),
  ListItem: createType(['Intangible'], {
    position: ['Integer', 'Text'],
    item: ['Thing', 'Text'],
    nextItem: ['ListItem'],
    previousItem: ['ListItem'],
  }),
  Event: createType(['Thing'], {
    startDate: ['Date', 'DateTime'],
    endDate: ['Date', 'DateTime'],
    location: ['Place', 'VirtualLocation', 'PostalAddress', 'Text'],
    eventStatus: ['EventStatusType', 'Text', 'URL'],
    eventAttendanceMode: ['EventAttendanceModeEnumeration', 'Text', 'URL'],
    offers: ['Offer', 'AggregateOffer'],
    organizer: ['Organization', 'Person'],
    performer: ['Person', 'Organization'],
    doorTime: ['DateTime', 'Text'],
    typicalAgeRange: ['Text'],
    maximumAttendeeCapacity: ['Integer'],
    remainingAttendeeCapacity: ['Integer'],
    superEvent: ['Event'],
    subEvent: ['Event'],
    eventSchedule: ['Schedule'],
  }),
  Question: createType(['CreativeWork'], {
    acceptedAnswer: ['Answer', 'ItemList'],
    suggestedAnswer: ['Answer', 'ItemList'],
    answerCount: ['Integer'],
    upvoteCount: ['Integer'],
    eduQuestionType: ['Text'],
    text: ['Text'],
  }),
  Answer: createType(['CreativeWork'], {
    text: ['Text'],
    upvoteCount: ['Integer'],
  }),
  Recipe: createType(['CreativeWork'], {
    cookTime: ['Duration'],
    prepTime: ['Duration'],
    totalTime: ['Duration'],
    recipeYield: ['Text', 'QuantitativeValue'],
    recipeCategory: ['Text'],
    recipeCuisine: ['Text'],
    recipeIngredient: ['Text'],
    recipeInstructions: ['Text', 'ItemList', 'HowToStep', 'HowToSection'],
    nutrition: ['NutritionInformation'],
    cookingMethod: ['Text'],
    suitableForDiet: ['RestrictedDiet', 'Text'],
  }),
  VideoObject: createType(['CreativeWork'], {
    uploadDate: ['Date', 'DateTime'],
    duration: ['Duration'],
    contentUrl: ['URL'],
    embedUrl: ['URL'],
    transcript: ['Text'],
    expires: ['Date', 'DateTime'],
  }),
  ImageObject: createType(['CreativeWork'], {
    contentUrl: ['URL'],
    caption: ['Text'],
    width: ['Distance', 'QuantitativeValue'],
    height: ['Distance', 'QuantitativeValue'],
    encodingFormat: ['Text', 'URL'],
  }),
  SearchAction: createType(['Action'], {
    'query-input': ['Text'],
    query: ['Text'],
  }),
  Action: createType(['Thing'], {
    target: ['URL', 'EntryPoint'],
    result: ['Thing'],
    instrument: ['Thing'],
    agent: ['Organization', 'Person'],
  }),
  EntryPoint: createType(['Intangible'], {
    urlTemplate: ['Text'],
    actionPlatform: ['URL', 'Text'],
    contentType: ['Text'],
    encodingType: ['Text'],
    httpMethod: ['Text'],
  }),
  Occupation: createType(['Intangible'], {
    occupationalCategory: ['Text', 'CategoryCode'],
    estimatedSalary: ['MonetaryAmount', 'MonetaryAmountDistribution'],
    occupationLocation: ['AdministrativeArea'],
    educationRequirements: ['Text', 'EducationalOccupationalCredential'],
    experienceRequirements: ['Text', 'OccupationalExperienceRequirements'],
    qualifications: ['Text'],
    skills: ['Text'],
    responsibilities: ['Text'],
  }),
  MonetaryAmount: createType(['StructuredValue'], {
    currency: ['Text'],
    value: ['Number', 'StructuredValue'],
    minValue: ['Number'],
    maxValue: ['Number'],
  }),
  QuantitativeValue: createType(['StructuredValue'], {
    value: ['Number'],
    minValue: ['Number'],
    maxValue: ['Number'],
    unitText: ['Text'],
    unitCode: ['Text', 'URL'],
  }),
  ContactPoint: createType(['StructuredValue'], {
    telephone: ['Text'],
    contactType: ['Text'],
    email: ['Text'],
    areaServed: ['Place', 'AdministrativeArea', 'Text'],
    availableLanguage: ['Language', 'Text'],
    contactOption: ['ContactPointOption', 'Text'],
  }),
  GeoCoordinates: createType(['StructuredValue'], {
    latitude: ['Number', 'Text'],
    longitude: ['Number', 'Text'],
    postalCode: ['Text'],
  }),
  VirtualLocation: createType(['Intangible'], {}),
  AdministrativeArea: createType(['Place'], {}),
  Country: createType(['AdministrativeArea'], {}),
  EducationalOrganization: createType(['Organization'], {}),
  PropertyValue: createType(['StructuredValue'], {
    propertyID: ['Text', 'URL'],
    value: ['Text', 'Number', 'Boolean', 'StructuredValue'],
  }),
  PriceSpecification: createType(['StructuredValue'], {
    price: ['Number', 'Text'],
    priceCurrency: ['Text'],
    minPrice: ['Number'],
    maxPrice: ['Number'],
  }),
  Language: createType(['Intangible'], {}),
  SpeakableSpecification: createType(['Intangible'], {
    cssSelector: ['Text'],
    xpath: ['Text'],
  }),
  OpeningHoursSpecification: createType(['StructuredValue'], {
    dayOfWeek: ['DayOfWeek', 'Text'],
    opens: ['Text'],
    closes: ['Text'],
    validFrom: ['Date', 'DateTime'],
    validThrough: ['Date', 'DateTime'],
  }),
  HowToStep: createType(['CreativeWork'], {
    text: ['Text'],
  }),
  HowToSection: createType(['CreativeWork'], {
    itemListElement: ['HowToStep'],
  }),
  NutritionInformation: createType(['StructuredValue'], {
    calories: ['Energy', 'Text'],
    servingSize: ['Text'],
  }),
  Schedule: createType(['Intangible'], {
    startDate: ['Date', 'DateTime'],
    endDate: ['Date', 'DateTime'],
    repeatFrequency: ['Text', 'Duration'],
    byDay: ['DayOfWeek', 'Text'],
  }),
};

const LOCAL_BUSINESS_SUBTYPES = [
  'AnimalShelter',
  'AutomotiveBusiness',
  'ChildCare',
  'Dentist',
  'DryCleaningOrLaundry',
  'EmergencyService',
  'EmploymentAgency',
  'EntertainmentBusiness',
  'FinancialService',
  'FoodEstablishment',
  'GovernmentOffice',
  'HealthAndBeautyBusiness',
  'HomeAndConstructionBusiness',
  'InternetCafe',
  'LegalService',
  'Library',
  'LodgingBusiness',
  'MedicalBusiness',
  'MedicalClinic',
  'ProfessionalService',
  'RadioStation',
  'RealEstateAgent',
  'RecyclingCenter',
  'SelfStorage',
  'ShoppingCenter',
  'SportsActivityLocation',
  'Store',
  'TelevisionStation',
  'TouristInformationCenter',
  'TravelAgency',
  'Restaurant',
  'Bakery',
  'BarOrPub',
  'CafeOrCoffeeShop',
  'FastFoodRestaurant',
  'Hotel',
  'Motel',
  'Hospital',
  'Pharmacy',
  'Physician',
] as const;

const FOOD_ESTABLISHMENTS = new Set([
  'Restaurant',
  'Bakery',
  'BarOrPub',
  'CafeOrCoffeeShop',
  'FastFoodRestaurant',
]);
const LODGING = new Set(['Hotel', 'Motel']);
const MEDICAL = new Set(['Dentist', 'MedicalClinic', 'Hospital', 'Pharmacy', 'Physician']);

for (const name of LOCAL_BUSINESS_SUBTYPES) {
  if (VOCABULARY[name]) continue;
  const parent = FOOD_ESTABLISHMENTS.has(name)
    ? 'FoodEstablishment'
    : LODGING.has(name)
      ? 'LodgingBusiness'
      : MEDICAL.has(name)
        ? 'MedicalBusiness'
        : 'LocalBusiness';
  if (name === 'FoodEstablishment' || name === 'LodgingBusiness' || name === 'MedicalBusiness') {
    VOCABULARY[name] = createType(['LocalBusiness'], {});
  } else {
    VOCABULARY[name] = createType([parent], {});
  }
}

const ARTICLE_SUBTYPES = ['AdvertiserContentArticle', 'Report', 'SatiricalArticle', 'ScholarlyArticle', 'TechArticle'];
for (const name of ARTICLE_SUBTYPES) {
  VOCABULARY[name] = createType(['Article'], {});
}

export const JSONLD_KEYWORDS = new Set([
  '@context',
  '@type',
  '@id',
  '@graph',
  '@value',
  '@language',
  '@reverse',
  '@index',
  '@list',
  '@set',
  '@container',
  '@vocab',
  '@base',
  '@included',
  '@direction',
  '@json',
  '@none',
  '@nest',
  '@prefix',
  '@protected',
  '@import',
  '@propagate',
  '@version',
]);

export function isKnownType(typeName: string): boolean {
  return Object.prototype.hasOwnProperty.call(VOCABULARY, typeName);
}

export function isSubtypeOf(typeName: string, ancestor: string): boolean {
  if (typeName === ancestor) return true;
  const queue = [typeName];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (current === ancestor) return true;
    const definition = VOCABULARY[current];
    if (!definition) continue;
    queue.push(...definition.parents);
  }
  return false;
}

export function expectationsFor(
  typeNames: readonly string[],
  property: string,
): readonly string[] | null {
  const collected: string[] = [];
  const seen = new Set<string>();
  let recognized = false;
  for (const typeName of typeNames) {
    const queue = [typeName];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      const definition = VOCABULARY[current];
      if (!definition) continue;
      recognized = true;
      const expectations = definition.properties[property];
      if (expectations) {
        for (const expectation of expectations) {
          if (!seen.has(expectation)) {
            seen.add(expectation);
            collected.push(expectation);
          }
        }
      }
      queue.push(...definition.parents);
    }
  }
  if (!recognized) return null;
  return collected;
}
