# MILLIMETRE V1 Architecture

## Rule
The repository remains intact. Existing modules are retained while new V1 domain code becomes the canonical source for all future workflows.

## Dependency direction

Project -> Measurements -> Furniture -> Calculation -> Cutting List -> BOM/BOQ -> Optimization -> Costing -> Commercial -> Fulfilment -> Production -> Handover -> Service -> Dashboard

Downstream modules must consume outputs from the preceding canonical layer; they must not recalculate dimensions independently.

## Canonical domain

`lib/millimetre/domain.ts` defines the shared project, measurement, furniture, material, component, calculation and cutting-list contracts.

Rules:
- all physical dimensions are millimetres;
- money is represented as numeric currency values at the domain boundary;
- furniture is the source object for component generation;
- components are the atomic manufacturing records;
- calculation is deterministic and side-effect free;
- cutting-list formatting is downstream of calculation.

## Current V1 implementation

- Foundation: canonical domain contracts.
- Measurements: `/measurements` workspace using the canonical measurement model.
- Furniture: `/furniture` workspace using the canonical furniture model.
- Calculation: deterministic cabinet/component engine in `lib/millimetre/calculation.ts`.
- Cutting list: stable ordering and CSV serialization in `lib/millimetre/cutting-list.ts`.

## Database boundary

Supabase remains the intended source of truth. The current connected Supabase project is inactive, so V1 domain code does not silently create a second local database or invent a schema. Database persistence will be wired only after the canonical relational schema is reviewed and established.

## QA gates

Each stage must pass:
1. type/build validation;
2. deterministic calculation checks;
3. persistence round-trip checks once the schema exists;
4. UI smoke verification;
5. production deployment verification.

No later module should be considered complete while it contains a parallel calculation or duplicate source of truth.
