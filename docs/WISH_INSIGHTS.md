# Wish insights and archive

The dashboard uses saved account wishes for the following features:

- Overall and per-banner 5-star / 4-star counts.
- Average, shortest, and longest recorded intervals between 5-star wishes.
- A paginated 5-star timeline with banner filters and existing rate-on/off labels.
- Item details showing all recorded occurrences and archive duplicate counts.
- History filters for name, banner, rarity, item type, inclusive dates, and page size.
- A summary of newly imported wishes, grouped by rarity, after each successful sync.

## Interpreting the numbers

Intervals count pulls within the same normalized banner group, including the ending 5-star wish. Character Event and Character Event Wish-2 share a group. The first recorded 5-star in each group has an unknown starting boundary and appears as a minimum (`>=`). It is excluded from averages, as are Beginner banner intervals. Missing records between known wishes can still undercount intervals.

The overall average pools eligible intervals from separate banner groups; it does not count intervening wishes from other groups. Empty metrics appear as a dash rather than a fabricated zero.

Primogem equivalent is recorded wish count multiplied by 160. It is not money spent and does not account for free wishes or discounts.

Item duplicate counts are occurrences minus one in the saved archive, not account constellation or weapon refinement. Item detail queries cover all banners independently of history filters. Legacy records without item IDs are matched by item name and type.

Name search treats `%` and `_` literally. Item-type filters support English and Indonesian labels. Dates follow game timestamps without timezone conversion. Apply filters with **Terapkan**; **Reset** restores the default view.

## Updating an existing installation

Copy the tracked API overlay into the Laravel runtime as described in the project setup, then run `php artisan migrate` from `apps/api`. Back up the existing database first. The migration adds a nullable summary column to sync sessions; it does not rewrite wishes.

Old sync sessions have no rarity summary. A summary is available after the next successful sync. Only newly inserted wishes count; syncing the same history again adds zero. The existing rate-up metadata and uncertainty rules are unchanged.

## Validation

`DashboardInsightsTest` covers interval boundaries, banner separation, empty archives, literal search, inclusive dates, item matching, pagination validation, and account isolation. `SyncFlowTest` covers new-wish summaries and duplicate imports. Run `php artisan test` from the API runtime and `npm run build` from `apps/web`.
