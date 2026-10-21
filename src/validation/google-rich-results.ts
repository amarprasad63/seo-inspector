import { readTypeValue } from '../parser/type-names';
import { isRecord } from '../shared/json';
import type { SchemaEntity } from '../shared/types';
import { makeFinding } from './finding';
import { isSubtypeOf } from './schema-org-vocabulary';
import type { Finding } from './types';
import { hasPresentValue, isDateLike, nonEmptyText } from './value-shape';

/**
 * Versioned local diagnostics for Google rich-result features.
 * These rules are not the Google Rich Results Test and do not decide eligibility.
 *
 * Last verified against Google Search Central documentation: 2026-10-01.
 */
export const GOOGLE_RULES_LAST_VERIFIED = '2026-10-01';

export const GOOGLE_RICH_RESULTS_TEST_URL = 'https://search.google.com/test/rich-results';

const DOCS = {
  job: 'https://developers.google.com/search/docs/appearance/structured-data/job-posting',
  product: 'https://developers.google.com/search/docs/appearance/structured-data/product',
  article: 'https://developers.google.com/search/docs/appearance/structured-data/article',
  breadcrumb: 'https://developers.google.com/search/docs/appearance/structured-data/breadcrumb',
  event: 'https://developers.google.com/search/docs/appearance/structured-data/event',
  recipe: 'https://developers.google.com/search/docs/appearance/structured-data/recipe',
  video: 'https://developers.google.com/search/docs/appearance/structured-data/video',
  logo: 'https://developers.google.com/search/docs/appearance/structured-data/logo',
  local: 'https://developers.google.com/search/docs/appearance/structured-data/local-business',
  faq: 'https://developers.google.com/search/docs/appearance/structured-data/faqpage',
} as const;

const EMPLOYMENT_TYPES = new Set([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACTOR',
  'TEMPORARY',
  'INTERN',
  'VOLUNTEER',
  'PER_DIEM',
  'OTHER',
]);

const AVAILABILITY = new Set([
  'BackOrder',
  'Discontinued',
  'InStock',
  'InStoreOnly',
  'LimitedAvailability',
  'OnlineOnly',
  'OutOfStock',
  'PreOrder',
  'PreSale',
  'SoldOut',
]);

const EVENT_STATUS = new Set([
  'EventCancelled',
  'EventMovedOnline',
  'EventPostponed',
  'EventRescheduled',
  'EventScheduled',
]);

export function evaluateGoogleRules(entities: readonly SchemaEntity[]): Finding[] {
  const findings: Finding[] = [];
  for (const entity of entities) {
    if (matches(entity, 'JobPosting')) findings.push(...jobPosting(entity));
    if (matches(entity, 'Product')) findings.push(...product(entity));
    if (matches(entity, 'Article')) findings.push(...article(entity));
    if (matches(entity, 'BreadcrumbList')) findings.push(...breadcrumb(entity));
    if (matches(entity, 'Event')) findings.push(...eventRule(entity));
    if (matches(entity, 'Recipe')) findings.push(...recipe(entity));
    if (matches(entity, 'VideoObject')) findings.push(...video(entity));
    if (matches(entity, 'Organization') && !matches(entity, 'LocalBusiness')) findings.push(...organizationLogo(entity));
    if (matches(entity, 'LocalBusiness')) findings.push(...localBusiness(entity));
    if (matches(entity, 'FAQPage')) findings.push(...faqPage(entity));
  }
  return findings;
}

function matches(entity: SchemaEntity, ancestor: string): boolean {
  return entity.types.some((typeName) => typeName === ancestor || isSubtypeOf(typeName, ancestor));
}

function base(
  entity: SchemaEntity,
  ruleId: string,
  severity: Finding['severity'],
  message: string,
  docsUrl: string,
  property?: string,
): Finding {
  return makeFinding({
    ruleId,
    severity,
    category: 'google-rich-results',
    message,
    path: entity.path,
    scriptIndex: entity.scriptIndex,
    property,
    entityType: entity.types.join(', '),
    docsUrl,
  });
}

function requireText(
  entity: SchemaEntity,
  property: string,
  ruleId: string,
  docsUrl: string,
  label: string,
): Finding | null {
  if (!hasPresentValue(entity.value[property])) {
    return base(entity, ruleId, 'error', `${label} is required for this Google rich-result feature but is missing.`, docsUrl, property);
  }
  if (nonEmptyText(entity.value[property]) === null) {
    return base(
      entity,
      `${ruleId}.shape`,
      'error',
      `${label} must be text for this Google rich-result feature.`,
      docsUrl,
      property,
    );
  }
  return null;
}

function jobPosting(entity: SchemaEntity): Finding[] {
  const findings: Finding[] = [];
  const docsUrl = DOCS.job;
  for (const [property, ruleId, label] of [
    ['title', 'google.jobposting.title', 'title'],
    ['description', 'google.jobposting.description', 'description'],
  ] as const) {
    const finding = requireText(entity, property, ruleId, docsUrl, label);
    if (finding) findings.push(finding);
  }

  if (!hasPresentValue(entity.value.datePosted)) {
    findings.push(base(entity, 'google.jobposting.datePosted', 'error', 'datePosted is required for JobPosting rich results.', docsUrl, 'datePosted'));
  } else if (!dateOk(entity.value.datePosted)) {
    findings.push(
      base(
        entity,
        'google.jobposting.datePosted.shape',
        'error',
        'datePosted must be a date or date-time, such as 2026-10-01.',
        docsUrl,
        'datePosted',
      ),
    );
  }

  if (!hasPresentValue(entity.value.hiringOrganization)) {
    findings.push(
      base(
        entity,
        'google.jobposting.hiringOrganization',
        'error',
        'hiringOrganization is required for JobPosting rich results.',
        docsUrl,
        'hiringOrganization',
      ),
    );
  } else {
    findings.push(...organizationShape(entity, 'hiringOrganization', 'google.jobposting.hiringOrganization.shape', docsUrl));
  }

  const locationType = nonEmptyText(entity.value.jobLocationType)?.toUpperCase() ?? '';
  const telecommute = locationType === 'TELECOMMUTE' || locationType.endsWith('/TELECOMMUTE');
  const hasLocation = hasPresentValue(entity.value.jobLocation);
  if (!hasLocation && !telecommute) {
    findings.push(
      base(
        entity,
        'google.jobposting.jobLocation',
        'error',
        'jobLocation is required unless jobLocationType is TELECOMMUTE, in which case applicantLocationRequirements is required.',
        docsUrl,
        'jobLocation',
      ),
    );
  }
  if (telecommute && !hasPresentValue(entity.value.applicantLocationRequirements)) {
    findings.push(
      base(
        entity,
        'google.jobposting.applicantLocationRequirements',
        'error',
        'applicantLocationRequirements is required when jobLocationType is TELECOMMUTE.',
        docsUrl,
        'applicantLocationRequirements',
      ),
    );
  }
  if (hasLocation) {
    const locations = asItems(entity.value.jobLocation);
    const invalid = locations.some((item) => typeof item === 'number' || typeof item === 'boolean');
    if (invalid) {
      findings.push(
        base(entity, 'google.jobposting.jobLocation.shape', 'warning', 'jobLocation should be a Place, not a number or boolean.', docsUrl, 'jobLocation'),
      );
    }
  }

  if (hasPresentValue(entity.value.employmentType)) {
    const types = asItems(entity.value.employmentType)
      .map((item) => nonEmptyText(item)?.split('/').pop()?.toUpperCase() ?? '')
      .filter(Boolean);
    if (types.some((item) => !EMPLOYMENT_TYPES.has(item))) {
      findings.push(
        base(
          entity,
          'google.jobposting.employmentType',
          'warning',
          `employmentType should use Google's values: ${[...EMPLOYMENT_TYPES].join(', ')}.`,
          docsUrl,
          'employmentType',
        ),
      );
    }
  } else {
    findings.push(
      base(entity, 'google.jobposting.employmentType.recommended', 'warning', 'employmentType is recommended for JobPosting rich results.', docsUrl, 'employmentType'),
    );
  }

  for (const [property, ruleId, message] of [
    ['validThrough', 'google.jobposting.validThrough', 'validThrough is recommended so Google knows when the posting expires.'],
    ['identifier', 'google.jobposting.identifier', 'identifier is recommended for JobPosting rich results.'],
    ['directApply', 'google.jobposting.directApply', 'directApply is recommended for JobPosting rich results.'],
  ] as const) {
    if (!hasPresentValue(entity.value[property])) {
      findings.push(base(entity, ruleId, 'warning', message, docsUrl, property));
    }
  }

  if (hasPresentValue(entity.value.baseSalary)) {
    findings.push(...salaryShape(entity, docsUrl));
  }

  return findings;
}

function product(entity: SchemaEntity): Finding[] {
  const findings: Finding[] = [];
  const docsUrl = DOCS.product;
  const name = requireText(entity, 'name', 'google.product.name', docsUrl, 'name');
  if (name) findings.push(name);

  const hasSignal =
    hasPresentValue(entity.value.review) ||
    hasPresentValue(entity.value.aggregateRating) ||
    hasPresentValue(entity.value.offers);
  if (!hasSignal) {
    findings.push(
      base(
        entity,
        'google.product.signal',
        'error',
        'Product snippets need at least one of review, aggregateRating, or offers. This local check does not decide merchant-listing eligibility.',
        docsUrl,
      ),
    );
  }

  if (!hasPresentValue(entity.value.image)) {
    findings.push(base(entity, 'google.product.image', 'warning', 'image is recommended for Product rich results.', docsUrl, 'image'));
  }
  if (!hasPresentValue(entity.value.description)) {
    findings.push(
      base(entity, 'google.product.description', 'info', 'description is recommended for Product rich results.', docsUrl, 'description'),
    );
  }

  if (hasPresentValue(entity.value.offers)) {
    for (const offer of asItems(entity.value.offers)) {
      if (!isRecord(offer)) {
        findings.push(
          base(entity, 'google.product.offers.shape', 'warning', 'offers should be an Offer or AggregateOffer object.', docsUrl, 'offers'),
        );
        continue;
      }
      if (!hasPresentValue(offer.price) && !hasPresentValue(offer.lowPrice)) {
        findings.push(
          base(
            entity,
            'google.product.offers.price',
            'warning',
            'offers should include price (or lowPrice on an AggregateOffer). Merchant listings treat price as required; product snippets treat it as recommended.',
            docsUrl,
            'offers',
          ),
        );
      }
      if (!hasPresentValue(offer.priceCurrency)) {
        findings.push(
          base(
            entity,
            'google.product.offers.priceCurrency',
            'warning',
            'offers should include priceCurrency as a 3-letter ISO 4217 code.',
            docsUrl,
            'offers',
          ),
        );
      } else if (!/^[A-Z]{3}$/.test(nonEmptyText(offer.priceCurrency) ?? '')) {
        findings.push(
          base(
            entity,
            'google.product.offers.priceCurrency.shape',
            'warning',
            'priceCurrency should be a 3-letter ISO 4217 code such as USD or INR.',
            docsUrl,
            'priceCurrency',
          ),
        );
      }
      if (hasPresentValue(offer.availability)) {
        const token = nonEmptyText(offer.availability)?.split('/').pop() ?? '';
        if (token && !AVAILABILITY.has(token)) {
          findings.push(
            base(
              entity,
              'google.product.offers.availability',
              'warning',
              `availability "${token}" is not a recognized schema.org ItemAvailability value.`,
              docsUrl,
              'availability',
            ),
          );
        }
      }
    }
  }

  return findings;
}

function article(entity: SchemaEntity): Finding[] {
  const docsUrl = DOCS.article;
  const findings: Finding[] = [];
  for (const [property, ruleId, message] of [
    ['headline', 'google.article.headline', 'headline is recommended for Article rich results.'],
    ['image', 'google.article.image', 'image is recommended for Article rich results.'],
    ['datePublished', 'google.article.datePublished', 'datePublished is recommended for Article rich results.'],
    ['author', 'google.article.author', 'author is recommended for Article rich results.'],
  ] as const) {
    if (!hasPresentValue(entity.value[property])) {
      findings.push(base(entity, ruleId, 'warning', message, docsUrl, property));
    }
  }
  if (hasPresentValue(entity.value.datePublished) && !dateOk(entity.value.datePublished)) {
    findings.push(
      base(entity, 'google.article.datePublished.shape', 'warning', 'datePublished should be an ISO 8601 date or date-time.', docsUrl, 'datePublished'),
    );
  }
  if (entity.types.some((typeName) => typeName === 'NewsArticle' || isSubtypeOf(typeName, 'NewsArticle'))) {
    findings.push(
      base(
        entity,
        'google.article.top-stories',
        'info',
        'Top stories eligibility depends on Google News policies that this local check does not evaluate.',
        docsUrl,
      ),
    );
  }
  return findings;
}

function breadcrumb(entity: SchemaEntity): Finding[] {
  const docsUrl = DOCS.breadcrumb;
  const findings: Finding[] = [];
  if (!hasPresentValue(entity.value.itemListElement)) {
    findings.push(
      base(entity, 'google.breadcrumb.itemListElement', 'error', 'itemListElement is required for BreadcrumbList rich results.', docsUrl, 'itemListElement'),
    );
    return findings;
  }
  const items = asItems(entity.value.itemListElement);
  items.forEach((item, index) => {
    if (!isRecord(item)) {
      findings.push(
        base(entity, 'google.breadcrumb.item', 'error', `Breadcrumb item ${index + 1} is not an object.`, docsUrl, 'itemListElement'),
      );
      return;
    }
    const types = '@type' in item ? readTypeValue(item['@type']).compact : [];
    if (types.length > 0 && !types.some((typeName) => typeName === 'ListItem' || isSubtypeOf(typeName, 'ListItem'))) {
      findings.push(
        base(
          entity,
          'google.breadcrumb.item-type',
          'warning',
          `Breadcrumb item ${index + 1} @type is ${types.join(', ')}. Google expects ListItem.`,
          docsUrl,
          'itemListElement',
        ),
      );
    }
    if (!hasPresentValue(item.position) || !integerOk(item.position)) {
      findings.push(
        base(
          entity,
          'google.breadcrumb.position',
          'error',
          `Breadcrumb item ${index + 1} needs an integer position.`,
          docsUrl,
          'position',
        ),
      );
    }
    const hasName = nonEmptyText(item.name) !== null;
    const hasItem = hasPresentValue(item.item);
    if (!hasName && !hasItem) {
      findings.push(
        base(
          entity,
          'google.breadcrumb.name-or-item',
          'error',
          `Breadcrumb item ${index + 1} needs a name, an item, or both.`,
          docsUrl,
          'name',
        ),
      );
    } else if (!hasName || !hasItem) {
      findings.push(
        base(
          entity,
          'google.breadcrumb.name-and-item',
          'warning',
          `Breadcrumb item ${index + 1} should include both name and item. One of them is missing.`,
          docsUrl,
          hasName ? 'item' : 'name',
        ),
      );
    }
  });
  return findings;
}

function eventRule(entity: SchemaEntity): Finding[] {
  const docsUrl = DOCS.event;
  const findings: Finding[] = [];
  const name = requireText(entity, 'name', 'google.event.name', docsUrl, 'name');
  if (name) findings.push(name);
  if (!hasPresentValue(entity.value.startDate)) {
    findings.push(base(entity, 'google.event.startDate', 'error', 'startDate is required for Event rich results.', docsUrl, 'startDate'));
  } else if (!dateOk(entity.value.startDate)) {
    findings.push(
      base(entity, 'google.event.startDate.shape', 'error', 'startDate must be a date or date-time.', docsUrl, 'startDate'),
    );
  }
  if (!hasPresentValue(entity.value.location)) {
    findings.push(
      base(entity, 'google.event.location', 'error', 'location is required for Event rich results (Place or VirtualLocation).', docsUrl, 'location'),
    );
  } else if (!isRecord(entity.value.location) && nonEmptyText(entity.value.location) === null && !Array.isArray(entity.value.location)) {
    findings.push(
      base(entity, 'google.event.location.shape', 'warning', 'location should be a Place, VirtualLocation, or text.', docsUrl, 'location'),
    );
  }
  if (hasPresentValue(entity.value.eventStatus)) {
    const token = nonEmptyText(entity.value.eventStatus)?.split('/').pop() ?? '';
    if (token && !EVENT_STATUS.has(token)) {
      findings.push(
        base(entity, 'google.event.eventStatus', 'warning', `eventStatus "${token}" is not a recognized EventStatusType.`, docsUrl, 'eventStatus'),
      );
    }
  }
  if (!hasPresentValue(entity.value.image)) {
    findings.push(base(entity, 'google.event.image', 'warning', 'image is recommended for Event rich results.', docsUrl, 'image'));
  }
  return findings;
}

function recipe(entity: SchemaEntity): Finding[] {
  const docsUrl = DOCS.recipe;
  const findings: Finding[] = [];
  const name = requireText(entity, 'name', 'google.recipe.name', docsUrl, 'name');
  if (name) findings.push(name);
  if (!hasPresentValue(entity.value.image)) {
    findings.push(base(entity, 'google.recipe.image', 'error', 'image is required for Recipe rich results.', docsUrl, 'image'));
  }
  for (const [property, ruleId, message] of [
    ['recipeIngredient', 'google.recipe.recipeIngredient', 'recipeIngredient is recommended for Recipe rich results.'],
    ['recipeInstructions', 'google.recipe.recipeInstructions', 'recipeInstructions is recommended for Recipe rich results.'],
    ['author', 'google.recipe.author', 'author is recommended for Recipe rich results.'],
  ] as const) {
    if (!hasPresentValue(entity.value[property])) {
      findings.push(base(entity, ruleId, 'warning', message, docsUrl, property));
    }
  }
  return findings;
}

function video(entity: SchemaEntity): Finding[] {
  const docsUrl = DOCS.video;
  const findings: Finding[] = [];
  const name = requireText(entity, 'name', 'google.video.name', docsUrl, 'name');
  if (name) findings.push(name);
  if (!hasPresentValue(entity.value.thumbnailUrl)) {
    findings.push(base(entity, 'google.video.thumbnailUrl', 'error', 'thumbnailUrl is required for Video rich results.', docsUrl, 'thumbnailUrl'));
  }
  if (!hasPresentValue(entity.value.uploadDate)) {
    findings.push(base(entity, 'google.video.uploadDate', 'error', 'uploadDate is required for Video rich results.', docsUrl, 'uploadDate'));
  } else if (!dateOk(entity.value.uploadDate)) {
    findings.push(
      base(entity, 'google.video.uploadDate.shape', 'error', 'uploadDate must be a date or date-time.', docsUrl, 'uploadDate'),
    );
  }
  if (!hasPresentValue(entity.value.description)) {
    findings.push(base(entity, 'google.video.description', 'warning', 'description is recommended for Video rich results.', docsUrl, 'description'));
  }
  if (!hasPresentValue(entity.value.contentUrl) && !hasPresentValue(entity.value.embedUrl)) {
    findings.push(
      base(
        entity,
        'google.video.contentUrl',
        'warning',
        'contentUrl or embedUrl is recommended so Google can find the video.',
        docsUrl,
        'contentUrl',
      ),
    );
  }
  return findings;
}

function organizationLogo(entity: SchemaEntity): Finding[] {
  const docsUrl = DOCS.logo;
  const findings: Finding[] = [];
  const hasLogo = hasPresentValue(entity.value.logo);
  if (!hasLogo) {
    findings.push(
      base(
        entity,
        'google.organization.logo',
        'info',
        'logo, url, and name are used for the organization logo feature. Missing logo is informational because not every Organization is targeting that feature.',
        docsUrl,
        'logo',
      ),
    );
    return findings;
  }
  if (!hasPresentValue(entity.value.url)) {
    findings.push(base(entity, 'google.organization.url', 'warning', 'url is required for the organization logo feature when logo is present.', docsUrl, 'url'));
  }
  if (nonEmptyText(entity.value.name) === null) {
    findings.push(base(entity, 'google.organization.name', 'warning', 'name is recommended for the organization logo feature.', docsUrl, 'name'));
  }
  return findings;
}

function localBusiness(entity: SchemaEntity): Finding[] {
  const docsUrl = DOCS.local;
  const findings: Finding[] = [];
  const name = requireText(entity, 'name', 'google.localbusiness.name', docsUrl, 'name');
  if (name) findings.push(name);
  if (!hasPresentValue(entity.value.address)) {
    findings.push(base(entity, 'google.localbusiness.address', 'error', 'address is required for LocalBusiness rich results.', docsUrl, 'address'));
  }
  for (const [property, ruleId, message] of [
    ['telephone', 'google.localbusiness.telephone', 'telephone is recommended for LocalBusiness rich results.'],
    ['geo', 'google.localbusiness.geo', 'geo is recommended for LocalBusiness rich results.'],
    ['image', 'google.localbusiness.image', 'image is recommended for LocalBusiness rich results.'],
  ] as const) {
    if (!hasPresentValue(entity.value[property])) {
      findings.push(base(entity, ruleId, 'warning', message, docsUrl, property));
    }
  }
  if (!hasPresentValue(entity.value.openingHours) && !hasPresentValue(entity.value.openingHoursSpecification)) {
    findings.push(
      base(
        entity,
        'google.localbusiness.openingHours',
        'warning',
        'openingHours or openingHoursSpecification is recommended for LocalBusiness rich results.',
        docsUrl,
        'openingHours',
      ),
    );
  }
  return findings;
}

function faqPage(entity: SchemaEntity): Finding[] {
  const docsUrl = DOCS.faq;
  const findings: Finding[] = [
    base(
      entity,
      'google.faq.eligibility',
      'info',
      'Google limits FAQ rich results to well-known government and health sites. This local check only looks at FAQPage structure and does not decide eligibility.',
      docsUrl,
    ),
  ];
  if (!hasPresentValue(entity.value.mainEntity)) {
    findings.push(
      base(entity, 'google.faq.mainEntity', 'warning', 'FAQPage should contain mainEntity questions with accepted answers.', docsUrl, 'mainEntity'),
    );
    return findings;
  }
  asItems(entity.value.mainEntity).forEach((item, index) => {
    if (!isRecord(item)) {
      findings.push(base(entity, 'google.faq.question', 'warning', `FAQ mainEntity item ${index + 1} is not an object.`, docsUrl, 'mainEntity'));
      return;
    }
    if (nonEmptyText(item.name) === null && nonEmptyText(item.text) === null) {
      findings.push(
        base(entity, 'google.faq.question-name', 'warning', `FAQ question ${index + 1} should include name or text.`, docsUrl, 'name'),
      );
    }
    const answers = asItems(item.acceptedAnswer).filter(isRecord);
    if (answers.length === 0) {
      findings.push(
        base(
          entity,
          'google.faq.acceptedAnswer',
          'warning',
          `FAQ question ${index + 1} should include acceptedAnswer.`,
          docsUrl,
          'acceptedAnswer',
        ),
      );
    } else if (answers.every((answer) => nonEmptyText(answer.text) === null && nonEmptyText(answer.name) === null)) {
      findings.push(
        base(entity, 'google.faq.answer-text', 'warning', `FAQ answer ${index + 1} should include text.`, docsUrl, 'acceptedAnswer'),
      );
    }
  });
  return findings;
}

function organizationShape(entity: SchemaEntity, property: string, ruleId: string, docsUrl: string): Finding[] {
  const value = entity.value[property];
  const items = asItems(value);
  if (items.some((item) => !isRecord(item) && nonEmptyText(item) === null)) {
    return [base(entity, ruleId, 'warning', `${property} should be an Organization object.`, docsUrl, property)];
  }
  const missingName = items.filter(isRecord).some((item) => nonEmptyText(item.name) === null && nonEmptyText(item.legalName) === null);
  if (missingName) {
    return [base(entity, ruleId, 'warning', `${property} should include a name.`, docsUrl, property)];
  }
  return [];
}

function salaryShape(entity: SchemaEntity, docsUrl: string): Finding[] {
  const value = entity.value.baseSalary;
  if (typeof value === 'number' || nonEmptyText(value)) return [];
  if (!isRecord(value)) {
    return [
      base(entity, 'google.jobposting.baseSalary.shape', 'warning', 'baseSalary should be a MonetaryAmount or a number.', docsUrl, 'baseSalary'),
    ];
  }
  const nested = isRecord(value.value) ? value.value : null;
  const hasValue = hasPresentValue(value.value) || (nested ? hasPresentValue(nested.value) : false);
  const hasCurrency = hasPresentValue(value.currency) || (nested ? hasPresentValue(nested.currency) || hasPresentValue(nested.unitText) : false);
  if (!hasValue || !hasCurrency) {
    return [
      base(
        entity,
        'google.jobposting.baseSalary.shape',
        'warning',
        'baseSalary should include a currency and a value.',
        docsUrl,
        'baseSalary',
      ),
    ];
  }
  return [];
}

function asItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function dateOk(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => dateOk(item));
  const text = nonEmptyText(value);
  return text !== null && isDateLike(text);
}

function integerOk(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value);
  const text = nonEmptyText(value);
  return text !== null && /^-?\d+$/.test(text);
}
