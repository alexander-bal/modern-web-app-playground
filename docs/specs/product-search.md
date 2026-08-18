# Product Search

## Overview

Product search lets a customer find products by keyword from anywhere in the storefront. A search bar in the site header submits a query to a dedicated results page, which returns active products whose name or description matches every word of the query as a word prefix. Results are paginated and can be ordered by match quality, by ascending price, or by descending price. Search complements the coarse-grained category filter on the catalog with fine-grained keyword navigation.

This specification covers the search contract: what a query matches, what it excludes, how results are ordered and paginated, and the surfaces that submit queries and render results. The product entity, its fields, its lifecycle, and the catalog and detail surfaces are owned by `products.md`; this feature reads those fields and honors the `active`-only visibility rule but does not define them.

This document states the required external contract; where the running system diverges from a stated requirement, the system is at fault, not this document.

## Goals and Non-Goals

### Goals

- Define the query contract: minimum length, whitespace handling, Unicode support, and the treatment of special characters
- Define matching semantics: which fields are searched, prefix matching, stemming, case-insensitivity, and multi-word conjunction
- Define the three ordering modes and the currency-grouping rule that keeps price ordering meaningful across currencies
- Define result pagination and the empty-result contract
- Define the header search bar and the search results surface, including the empty, too-short, and no-match states

### Non-Goals

- Autocomplete, type-ahead suggestions, spelling correction, synonyms, and fuzzy matching
- Faceted search — aggregate counts by category or price bucket
- Filter combinations beyond the query itself (price range, multi-category, availability)
- Search history, saved searches, personalization, and trending-query surfaces
- Searching entities other than products — orders, users, and content pages
- The product entity and the catalog and detail surfaces (`products.md`)

## Functional Requirements

### FR-1: Search Query Contract

- The system SHALL expose `GET /api/products/search`, accepting the query as the `q` parameter.
- The system SHALL trim leading and trailing whitespace from the query before matching.
- The system SHALL reject a missing, empty, or too-short query as a validation error (LIM-1).
- The system SHALL accept Unicode characters in a query, so products named in any script remain findable.
- The system SHALL treat special characters in the query as literal text rather than as query operators.
- The endpoint SHALL be reachable without authentication.

### FR-2: Matching Semantics

- The system SHALL match the query against a product's `name` and `description` only, and SHALL NOT match against `sku`, `category`, or `tags`.
- The system SHALL treat each word of the query as a word prefix: `lapt` SHALL match `laptop`, and `wirele` SHALL match `wireless`.
- The system SHALL require every word of a multi-word query to match, in any order and not necessarily adjacently: `blue shirt` SHALL match a product named `blue cotton shirt`.
- The system SHALL match case-insensitively.
- The system SHALL apply English stemming, so a query word and its inflected forms match one another (CON-1).
- The system SHALL return only products with `active` status; `draft` and `archived` products SHALL never appear in results (`products.md` LIM-6, LIM-3 below).

### FR-3: Result Contract

- A search result SHALL carry the same product fields as a catalog listing entry (`products.md` FR-6).
- Results SHALL be paginated, with the same page-size bounds and defaults as the catalog (LIM-2).
- The response SHALL carry the total number of matching products, the current page, and the total page count.
- A query that matches no product SHALL return an empty result set with a total count of zero — not an error (FR-5).

### FR-4: Ordering

- The system SHALL support three ordering modes, selected by the `sort` parameter: `relevance`, `price_asc`, and `price_desc` (LIM-4).
- Ordering SHALL default to `relevance`, placing the best match first as ranked by match quality; a match in the product name SHALL rank above a match of equal strength in the description (LIM-5).
- Under either price ordering, results SHALL be grouped by currency in alphabetical currency order, so products priced in different currencies are never interleaved and a price comparison is never made across currencies.
- Under either price ordering, ties SHALL be broken by product name, so equal-priced products hold a stable, repeatable order across pages.
- Changing the ordering mode SHALL reset the result set to the first page, so a reordering never leaves the customer on a page that no longer exists.

### FR-5: Search Results Surface

- The search results surface SHALL be addressed at `/search` and SHALL take its query from the `q` parameter, its ordering from the optional `sort` parameter, and its page from the optional `page` parameter of the address.
- The surface SHALL display the submitted query and the total number of results found.
- The surface SHALL render matching products in the same card grid used by the catalog (`products.md` FR-7).
- The surface SHALL offer controls to switch between the three ordering modes, and SHALL reflect the chosen mode in the address so a result page is shareable and survives a reload.
- The surface SHALL display pagination controls when results exceed one page.
- The surface SHALL display a loading indicator while results are being retrieved and an error state when retrieval fails.
- When the query matches no product, the surface SHALL display an empty state inviting the customer to try different keywords.
- When the address carries no query or an empty one, the surface SHALL display an empty state instructing the customer to enter a query, and SHALL NOT issue a search request.
- When the query is shorter than the minimum length, the surface SHALL display validation feedback rather than issue a search request (LIM-1).

### FR-6: Header Search Bar

- The site header SHALL present a search input on every page, including the search results surface itself.
- Submitting the search — by keyboard or by activating the search control — SHALL navigate to the search results surface carrying the entered query and the default ordering.
- The search bar SHALL NOT issue search requests while the customer types.
- On the search results surface, the search bar SHALL display the current query so the customer can see and amend what they searched for.
- On navigating away from the search results surface, the search bar SHALL clear.
- The search input SHALL be reachable and operable by keyboard and SHALL carry an accessible label.

## Technical Requirements (System Limits)

- **LIM-1 — Minimum query length.** A search query is at least 2 characters after trimming; a shorter or empty query is rejected and never reaches the catalog. (FR-1, FR-5)
- **LIM-2 — Page size bounds.** Search page size is an integer in the range 1–100 inclusive, defaulting to 20; the page number starts at 1 and defaults to 1. A value outside those bounds is rejected. (FR-3)
- **LIM-3 — Active products only.** No `draft` or `archived` product is returned by any query, under any ordering, at any page. (FR-2; Security)
- **LIM-4 — Closed ordering vocabulary.** The `sort` parameter accepts only `relevance`, `price_asc`, and `price_desc`; any other value is rejected. (FR-4)
- **LIM-5 — Name outranks description.** In relevance ordering, a match against the product name contributes more to rank than an equally strong match against the description. (FR-4)

## Constraints (Externally Imposed)

- **CON-1 — English text-search configuration.** Stemming and stop-word handling follow the English text-search configuration of the underlying database; which words stem together, and which are discarded as stop words, is defined by that configuration and not by this feature. A catalog in another language inherits English stemming behavior. (FR-2)
- **CON-2 — Product entity and visibility.** The searchable fields, the product status vocabulary, and the `active`-only storefront rule are owned by `products.md`; this feature consumes them. (FR-2, FR-3)
- **CON-3 — Result shape parity.** A search result carries the catalog listing entry's field set; a change to that shape changes search responses too. (FR-3)

## Error Scenarios

| Scenario | Response |
|---|---|
| Query shorter than 2 characters after trimming | HTTP 400 — "Search query must be at least 2 characters" |
| `q` parameter missing or empty | HTTP 400 — validation error |
| `sort` outside `relevance` / `price_asc` / `price_desc` | HTTP 400 — validation error |
| Page number below 1, or page size outside 1–100 | HTTP 400 — validation error |
| No product matches the query | HTTP 200 with an empty result set and a total count of 0 |
| Search fails unexpectedly | HTTP 500 — internal server error; the full error is logged server-side |
| Search results surface opened with no query | Empty state instructing the customer to enter a query; no request issued |
| Search results surface opened with a too-short query | Validation feedback on the surface; no request issued |

## Security Considerations

- A search query SHALL be treated as untrusted input and validated at the API boundary before it reaches the catalog (FR-1, LIM-1).
- A query SHALL never be interpretable as a query-language operator or as executable database syntax; special characters SHALL be matched as literal text (FR-1).
- Search SHALL never return a `draft` or `archived` product, so the search surface cannot be used to discover products the catalog deliberately withholds (LIM-3).

## Monitoring and Observability

- A search that exceeds 500 ms SHALL be logged with its query text and result count, so degradation in match latency is observable before customers report it.
- A query returning zero results SHALL be logged, so gaps between what customers look for and what the catalog carries are observable.

## References

### Related Specs

- `products.md` — the product entity, the searchable fields, the status vocabulary, and the catalog grid the results surface reuses
