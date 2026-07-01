# Plan Features View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-CRUD sub-panel that displays feature entitlements (toggles + quantitative limits) bound to a specific Subscription Plan, accessible from the Subscription Plans table via a "View Features" icon button, with Map/Edit/Delete actions.

**Architecture:** Three minimal backend changes unlock the `subscriptionPlanId` filter, expose `feature.Unit` in the list response, and fix `update()` to persist `status`. Frontend: type + service methods, a single TDD test suite covering the whole component's behavior, the component itself (mirroring `PlanApplicationsView`/`PlatformFeatureCatalogView` structurally, with three dialogs: Map, Edit, Delete), and shell navigation wiring.

**Tech Stack:** NestJS + TypeORM (backend), React 19 + TypeScript + Vitest + React Testing Library + Tailwind v4 (frontend)

## Global Constraints

- Backend repo root: `C:\Users\Rafael Cordero\x7-pos-back-end`
- Frontend repo root: `C:\Users\Rafael Cordero\x7-pos-backoffice`
- Branch (both repos): `rafaalejandro_subscription`
- Design tokens: `#222222` structural dark, `#ae001a` primary red, `#f2ede5` warm surface, `#e8e2d8` border, `#5f5e5e` secondary text, `#1d1c17` primary text
- Status badges: active → `bg-green-500/10 text-green-600`; inactive → `bg-[#5f5e5e]/20 text-[#5f5e5e]`
- Code snippet class: `font-mono text-[11px] text-[#5f5e5e] bg-[#f2ede5] px-1.5 py-0.5 rounded`
- All text labels uppercase tracking-widest `text-[11px] font-bold`
- Empty-state copy (AC4, exact): "This subscription plan currently has no features or limits mapped. Click 'Map Feature' to establish your first entitlement rule."
- Dark banner copy (AC2, exact): `FEATURE ENTITLEMENTS BOUND TO PLAN: {plan.name}`
- Breadcrumb (AC1, exact): `SaaS Admin › Subscription Architecture › Plan Features`
- TDD: the full test suite is written and run (failing) before the component exists
- Frequent commits — one per task

---

## File Map

| File | Repo | Action |
|---|---|---|
| `src/platform-saas/subscriptions/plan-features/dto/query-plan-feature.dto.ts` | backend | Modify — add `subscriptionPlanId` field |
| `src/platform-saas/subscriptions/plan-features/dto/plan-feature-response.dto.ts` | backend | Modify — add `unit` to `feature` shape |
| `src/platform-saas/subscriptions/plan-features/plan-features.service.ts` | backend | Modify — filter by planId, expose `feature.Unit`, persist `status` on update |
| `src/platform-saas/subscriptions/plan-features/plan-features.service.spec.ts` | backend | Modify — add 3 tests for the above |
| `src/types/subscription.ts` | frontend | Modify — add `PlanFeature`, `CreatePlanFeatureDto`, `UpdatePlanFeatureDto` |
| `src/services/saasService.ts` | frontend | Modify — add `getPlanFeatures`, `createPlanFeature`, `updatePlanFeature`, `deletePlanFeature` |
| `src/components/SaaSDashboard/PlanFeaturesView.test.tsx` | frontend | Create — ~20 test cases (written before component) |
| `src/components/SaaSDashboard/PlanFeaturesView.tsx` | frontend | Create — full CRUD view component |
| `src/components/SaaSDashboard/SaaSDashboard.tsx` | frontend | Modify — new `renderContent` case, breadcrumbs, header title/description |
| `src/components/SaaSDashboard/SubscriptionPlansView.tsx` | frontend | Modify — `tune` row-action button |

---

### Task 1: Backend — `subscriptionPlanId` filter + expose `feature.Unit`

**Files:**
- Modify: `src/platform-saas/subscriptions/plan-features/dto/query-plan-feature.dto.ts`
- Modify: `src/platform-saas/subscriptions/plan-features/dto/plan-feature-response.dto.ts`
- Modify: `src/platform-saas/subscriptions/plan-features/plan-features.service.ts`
- Modify: `src/platform-saas/subscriptions/plan-features/plan-features.service.spec.ts`

**Interfaces:**
- Produces: `GET /plan-features?subscriptionPlanId=3` returns only records for plan 3, each with `feature.unit` in the response

- [ ] **Step 1: Add `subscriptionPlanId` to the DTO**

Replace the entire file `src/platform-saas/subscriptions/plan-features/dto/query-plan-feature.dto.ts` with:

```ts
//src/subscriptions/plan-features/dto/query-plan-feature.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryPlanFeatureDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['active', 'inactive', 'deleted'],
    example: 'active',
  })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive', 'deleted'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by subscription plan ID',
    example: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  subscriptionPlanId?: number;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Column to sort by',
    enum: ['id'],
    example: 'id',
  })
  @IsOptional()
  @IsIn(['id'])
  sortBy?: 'id';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
```

- [ ] **Step 2: Add `unit` to the response DTO's `feature` shape**

In `src/platform-saas/subscriptions/plan-features/dto/plan-feature-response.dto.ts`, replace the `feature` property declaration (currently `@ApiProperty({ example: { id: 1, name: 'Feature' } }) feature: { id: number; name: string };`) with:

```ts
  @ApiProperty({ example: { id: 1, name: 'Feature', unit: 'user' } })
  feature: { id: number; name: string; unit: string };
```

- [ ] **Step 3: Update `findAll` in the service — select + filter + mapping**

In `src/platform-saas/subscriptions/plan-features/plan-features.service.ts`, make three edits inside `findAll`:

**3a — destructure `subscriptionPlanId` from query:**

Replace:
```ts
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = 'id',
      sortOrder = 'DESC',
    } = query;
```
With:
```ts
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = 'id',
      sortOrder = 'DESC',
      subscriptionPlanId,
    } = query;
```

**3b — add `feature.Unit` to the QueryBuilder select:**

Replace:
```ts
      .select([
        'planFeature',
        'subscriptionPlan.id',
        'subscriptionPlan.name',
        'subscriptionPlan.status',
        'feature.id',
        'feature.name',
        'feature.status',
      ]);
```
With:
```ts
      .select([
        'planFeature',
        'subscriptionPlan.id',
        'subscriptionPlan.name',
        'subscriptionPlan.status',
        'feature.id',
        'feature.name',
        'feature.Unit',
        'feature.status',
      ]);
```

**3c — add the planId filter** (after the existing `qb.andWhere('planFeature.status != :deleted', ...)` block):

```ts
    if (subscriptionPlanId) {
      qb.andWhere('subscriptionPlan.id = :subscriptionPlanId', {
        subscriptionPlanId,
      });
    }
```

**3d — add `unit` to the mapped response:**

Replace:
```ts
    const mapped: PlanFeatureResponseDto[] = data.map((item) => ({
      id: item.id,
      limit_value: Number(item.limit_value),
      status: item.status,

      subscriptionPlan: {
        id: item.subscriptionPlan.id,
        name: item.subscriptionPlan.name,
      },

      feature: {
        id: item.feature.id,
        name: item.feature.name,
      },
    }));
```
With:
```ts
    const mapped: PlanFeatureResponseDto[] = data.map((item) => ({
      id: item.id,
      limit_value: Number(item.limit_value),
      status: item.status,

      subscriptionPlan: {
        id: item.subscriptionPlan.id,
        name: item.subscriptionPlan.name,
      },

      feature: {
        id: item.feature.id,
        name: item.feature.name,
        unit: item.feature.Unit,
      },
    }));
```

- [ ] **Step 4: Add tests to the service spec**

In `src/platform-saas/subscriptions/plan-features/plan-features.service.spec.ts`, add a new `describe` block at the end of the file, right before the final closing `});` of the outer `describe('PlanFeaturesService', ...)` block (i.e. after the `Repository Integration` block, still inside the outer describe):

```ts
  describe('Find All — subscriptionPlanId filter and unit mapping', () => {
    let filterQueryBuilder: any;

    beforeEach(() => {
      filterQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 1,
              limit_value: 10,
              status: 'active',
              subscriptionPlan: { id: 3, name: 'Gold Plan' },
              feature: { id: 5, name: 'Max Users', Unit: 'user' },
            },
          ],
          1,
        ]),
      };
      repository.createQueryBuilder.mockReturnValue(filterQueryBuilder);
    });

    it('calls andWhere with subscriptionPlanId when provided', async () => {
      await service.findAll({ subscriptionPlanId: 3, page: 1, limit: 10 });
      expect(filterQueryBuilder.andWhere).toHaveBeenCalledWith(
        'subscriptionPlan.id = :subscriptionPlanId',
        { subscriptionPlanId: 3 },
      );
    });

    it('includes feature.unit in the mapped response', async () => {
      const result = await service.findAll({
        subscriptionPlanId: 3,
        page: 1,
        limit: 10,
      });
      expect(result.data[0]).toHaveProperty('feature');
      expect((result.data[0] as any).feature).toHaveProperty('unit', 'user');
    });
  });
```

- [ ] **Step 5: Run the backend tests**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-back-end"
npx jest plan-features.service.spec --no-coverage
```

Expected: all tests pass, including the 2 new ones.

- [ ] **Step 6: Commit backend changes**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-back-end"
git add src/platform-saas/subscriptions/plan-features/dto/query-plan-feature.dto.ts
git add src/platform-saas/subscriptions/plan-features/dto/plan-feature-response.dto.ts
git add src/platform-saas/subscriptions/plan-features/plan-features.service.ts
git add src/platform-saas/subscriptions/plan-features/plan-features.service.spec.ts
git commit -m "feat: add subscriptionPlanId filter and feature.unit to plan-features findAll"
```

---

### Task 2: Backend — fix `update()` to persist `status`

**Files:**
- Modify: `src/platform-saas/subscriptions/plan-features/plan-features.service.ts`
- Modify: `src/platform-saas/subscriptions/plan-features/plan-features.service.spec.ts`

**Interfaces:**
- Produces: `PATCH /plan-features/:id` with `{ status: 'inactive' }` actually changes the persisted status (previously silently ignored)

- [ ] **Step 1: Write the failing test**

In `src/platform-saas/subscriptions/plan-features/plan-features.service.spec.ts`, inside the existing `describe('Update Plan Feature', ...)` block, add this test right after the `'should update and return a plan feature successfully'` test:

```ts
    it('applies dto.status even when it differs from the current status', async () => {
      const currentPlanFeature = { ...mockPlanFeature, status: 'active' };
      const dtoWithDifferentStatus: UpdatePlanFeatureDto = {
        ...mockUpdatePlanFeatureDto,
        status: 'inactive',
      };
      const findOneSpy = jest.spyOn(repository, 'findOne');
      const saveSpy = jest.spyOn(repository, 'save');

      findOneSpy.mockResolvedValue(currentPlanFeature as PlanFeature);
      saveSpy.mockResolvedValue({
        ...currentPlanFeature,
        status: 'inactive',
      } as PlanFeature);

      await service.update(1, dtoWithDifferentStatus);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'inactive' }),
      );
    });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-back-end"
npx jest plan-features.service.spec --no-coverage -t "applies dto.status"
```

Expected: FAIL — `saveSpy` was called with `status: 'active'` (unchanged), not `'inactive'`.

- [ ] **Step 3: Fix `update()` in the service**

In `src/platform-saas/subscriptions/plan-features/plan-features.service.ts`, replace:

```ts
    if (dto.limit_value !== undefined) {
      planFeature.limit_value = dto.limit_value;
    }
```
With:
```ts
    if (dto.limit_value !== undefined) {
      planFeature.limit_value = dto.limit_value;
    }
    if (dto.status !== undefined) {
      planFeature.status = dto.status;
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-back-end"
npx jest plan-features.service.spec --no-coverage
```

Expected: all tests pass, including the new one.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-back-end"
git add src/platform-saas/subscriptions/plan-features/plan-features.service.ts
git add src/platform-saas/subscriptions/plan-features/plan-features.service.spec.ts
git commit -m "fix: persist status in plan-features update()"
```

---

### Task 3: Frontend — types + service methods

**Files:**
- Modify: `src/types/subscription.ts`
- Modify: `src/services/saasService.ts`

**Interfaces:**
- Produces: `PlanFeature`, `CreatePlanFeatureDto`, `UpdatePlanFeatureDto` types; `saasService.getPlanFeatures(planId): Promise<PlanFeature[]>`, `saasService.createPlanFeature(dto): Promise<PlanFeature>`, `saasService.updatePlanFeature(id, dto): Promise<PlanFeature>`, `saasService.deletePlanFeature(id): Promise<PlanFeature>`

- [ ] **Step 1: Add types to `src/types/subscription.ts`**

Append at the end of the file (after the `PlanApplication` interface):

```ts

export interface PlanFeature {
  id: number;
  subscriptionPlan: { id: number; name: string };
  feature: { id: number; name: string; unit: string };
  limit_value: number;
  status: string;
}

export interface CreatePlanFeatureDto {
  subscriptionPlan: number;
  feature: number;
  limit_value: number;
  status: 'active';
}

export interface UpdatePlanFeatureDto {
  limit_value: number;
  status: 'active' | 'inactive';
}
```

- [ ] **Step 2: Add service methods to `src/services/saasService.ts`**

**2a — Update the import at line 2** to include the new types:

```ts
import type { SubscriptionPlan, CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto, Application, PlatformFeature, PlanApplication, CreatePlanApplicationDto, UpdatePlanApplicationDto, PlanFeature, CreatePlanFeatureDto, UpdatePlanFeatureDto } from '../types/subscription';
```

**2b — Add the methods after `updatePlanApplication`** (at the end of the `saasService` object, before the closing `};`):

```ts

  async getPlanFeatures(planId: number): Promise<PlanFeature[]> {
    const response = await saasApiFetch<{
      data: PlanFeature[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>(`plan-features?subscriptionPlanId=${planId}&limit=100`);
    return response.data;
  },

  async createPlanFeature(dto: CreatePlanFeatureDto): Promise<PlanFeature> {
    const response = await saasApiFetch<{ data: PlanFeature }>(
      'plan-features',
      { method: 'POST', body: JSON.stringify(dto) },
    );
    return response.data;
  },

  async updatePlanFeature(id: number, dto: UpdatePlanFeatureDto): Promise<PlanFeature> {
    const response = await saasApiFetch<{ data: PlanFeature }>(
      `plan-features/${id}`,
      { method: 'PATCH', body: JSON.stringify(dto) },
    );
    return response.data;
  },

  async deletePlanFeature(id: number): Promise<PlanFeature> {
    const response = await saasApiFetch<{ data: PlanFeature }>(
      `plan-features/${id}`,
      { method: 'DELETE' },
    );
    return response.data;
  },
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
git add src/types/subscription.ts src/services/saasService.ts
git commit -m "feat: add PlanFeature types and saasService plan-feature methods"
```

---

### Task 4: Write failing tests for `PlanFeaturesView` (TDD)

**Files:**
- Create: `src/components/SaaSDashboard/PlanFeaturesView.test.tsx`

**Interfaces:**
- Consumes: `PlanFeature`, `SubscriptionPlan`, `PlatformFeature` from `../../types/subscription`; mocked `saasService.getPlanFeatures`, `saasService.getFeatures`, `saasService.createPlanFeature`, `saasService.updatePlanFeature`, `saasService.deletePlanFeature`
- Produces: failing test suite (component does not exist yet)

- [ ] **Step 1: Create the test file**

Create `src/components/SaaSDashboard/PlanFeaturesView.test.tsx`:

```tsx
//src/components/SaaSDashboard/PlanFeaturesView.test.tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanFeaturesView } from './PlanFeaturesView';
import { saasService } from '../../services/saasService';
import type { PlanFeature, SubscriptionPlan, PlatformFeature } from '../../types/subscription';

vi.mock('../../services/saasService', () => ({
  saasService: {
    getPlanFeatures: vi.fn(),
    getFeatures: vi.fn(),
    createPlanFeature: vi.fn(),
    updatePlanFeature: vi.fn(),
    deletePlanFeature: vi.fn(),
  },
}));

const MOCK_PLAN: SubscriptionPlan = {
  id: 3,
  name: 'Gold Plan',
  description: 'Full-featured tier.',
  price: 99.99,
  billingCycle: 'monthly',
  status: 'active',
};

const MOCK_PLAN_FEATURES: PlanFeature[] = [
  {
    id: 1,
    subscriptionPlan: { id: 3, name: 'Gold Plan' },
    feature: { id: 10, name: 'Max Users', unit: 'user' },
    limit_value: 10,
    status: 'active',
  },
  {
    id: 2,
    subscriptionPlan: { id: 3, name: 'Gold Plan' },
    feature: { id: 11, name: 'Storage Cap', unit: 'gb' },
    limit_value: 500,
    status: 'inactive',
  },
];

const MOCK_CATALOG_FEATURES: PlatformFeature[] = [
  { id: 10, name: 'Max Users', description: 'User cap', Unit: 'user', status: 'active' },
  { id: 11, name: 'Storage Cap', description: 'Storage cap', Unit: 'gb', status: 'active' },
  { id: 12, name: 'API Calls', description: 'API call cap', Unit: 'unit', status: 'active' },
];
// ids 10 and 11 are already in MOCK_PLAN_FEATURES; only id 12 should appear in the Map Feature dropdown

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlanFeaturesView — loading state', () => {
  it('shows skeleton rows while data is loading', () => {
    vi.mocked(saasService.getPlanFeatures).mockReturnValue(new Promise(() => {}));
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('PlanFeaturesView — title banner (AC2)', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanFeatures).mockResolvedValue(MOCK_PLAN_FEATURES);
  });

  it('shows the dark title banner with plan name', async () => {
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(
        screen.getByText(/FEATURE ENTITLEMENTS BOUND TO PLAN: Gold Plan/i),
      ).toBeInTheDocument();
    });
  });
});

describe('PlanFeaturesView — table rendering (AC3)', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanFeatures).mockResolvedValue(MOCK_PLAN_FEATURES);
  });

  it('renders one row per plan feature', async () => {
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('Max Users')).toBeInTheDocument();
      expect(screen.getByText('Storage Cap')).toBeInTheDocument();
    });
  });

  it('shows the feature ID as a monospace badge below the name', async () => {
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('renders the measurement unit in brackets', async () => {
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('[user]')).toBeInTheDocument();
      expect(screen.getByText('[gb]')).toBeInTheDocument();
    });
  });

  it('formats the assigned cap to exactly two decimals', async () => {
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('10.00')).toBeInTheDocument();
      expect(screen.getByText('500.00')).toBeInTheDocument();
    });
  });

  it('renders active status badge with emerald styling', async () => {
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      const badge = screen.getAllByText(/^active$/i)[0];
      expect(badge.className).toContain('text-green-600');
    });
  });

  it('renders inactive status badge with grey styling', async () => {
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      const badge = screen.getByText(/^inactive$/i);
      expect(badge.className).toContain('text-[#5f5e5e]');
    });
  });
});

describe('PlanFeaturesView — empty state (AC4)', () => {
  it('hides the table and shows the empty state block with the exact message', async () => {
    vi.mocked(saasService.getPlanFeatures).mockResolvedValue([]);
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(
        screen.getByText(
          /This subscription plan currently has no features or limits mapped\. Click 'Map Feature' to establish your first entitlement rule\./i,
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('PlanFeaturesView — search and status filter', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanFeatures).mockResolvedValue(MOCK_PLAN_FEATURES);
  });

  it('filters rows by feature name in real time', async () => {
    const user = userEvent.setup();
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('Max Users')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search/i), 'Max');

    expect(screen.getByText('Max Users')).toBeInTheDocument();
    expect(screen.queryByText('Storage Cap')).not.toBeInTheDocument();
  });

  it('shows only inactive rows when "inactive" is selected in the status filter', async () => {
    const user = userEvent.setup();
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('Max Users')).toBeInTheDocument());

    await user.selectOptions(
      screen.getByRole('combobox', { name: /entitlement status/i }),
      'inactive',
    );

    expect(screen.getByText('Storage Cap')).toBeInTheDocument();
    expect(screen.queryByText('Max Users')).not.toBeInTheDocument();
  });
});

describe('PlanFeaturesView — Map Feature happy path', () => {
  it('excludes already-mapped features, submits, and prepends the new row', async () => {
    const user = userEvent.setup();
    const newPF: PlanFeature = {
      id: 99,
      subscriptionPlan: { id: 3, name: 'Gold Plan' },
      feature: { id: 12, name: 'API Calls', unit: 'unit' },
      limit_value: 1000,
      status: 'active',
    };
    vi.mocked(saasService.getPlanFeatures).mockResolvedValue(MOCK_PLAN_FEATURES);
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_CATALOG_FEATURES);
    vi.mocked(saasService.createPlanFeature).mockResolvedValue(newPF);
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('Max Users')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /map feature/i }));
    await waitFor(() => expect(screen.getByText('API Calls (unit)')).toBeInTheDocument());

    expect(screen.queryByText('Max Users (user)')).not.toBeInTheDocument();
    expect(screen.queryByText('Storage Cap (gb)')).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: /^feature$/i }),
      String(12),
    );
    await user.type(screen.getByLabelText(/assigned cap/i), '1000');
    await user.click(screen.getByRole('button', { name: /^map$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
      expect(screen.getByText('Feature mapped successfully')).toBeInTheDocument();
      expect(screen.getByText('API Calls')).toBeInTheDocument();
    });
  });
});

describe('PlanFeaturesView — Edit happy path', () => {
  it('pre-fills the modal, saves changes, and updates the row', async () => {
    const user = userEvent.setup();
    const updatedPF: PlanFeature = {
      ...MOCK_PLAN_FEATURES[0],
      limit_value: 20,
      status: 'inactive',
    };
    vi.mocked(saasService.getPlanFeatures).mockResolvedValue(MOCK_PLAN_FEATURES);
    vi.mocked(saasService.updatePlanFeature).mockResolvedValue(updatedPF);
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('Max Users')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit max users/i }));
    await waitFor(() => expect(screen.getByDisplayValue('10')).toBeInTheDocument());

    await user.clear(screen.getByDisplayValue('10'));
    await user.type(screen.getByLabelText(/assigned cap/i), '20');
    await user.selectOptions(
      screen.getByRole('combobox', { name: /feature status/i }),
      'inactive',
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
      expect(screen.getByText('Plan-feature updated successfully')).toBeInTheDocument();
      expect(screen.getByText('20.00')).toBeInTheDocument();
    });
  });
});

describe('PlanFeaturesView — Delete happy path', () => {
  it('confirms removal and removes the row from the grid', async () => {
    const user = userEvent.setup();
    vi.mocked(saasService.getPlanFeatures).mockResolvedValue(MOCK_PLAN_FEATURES);
    vi.mocked(saasService.deletePlanFeature).mockResolvedValue({
      ...MOCK_PLAN_FEATURES[0],
      status: 'deleted',
    });
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('Max Users')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /remove max users/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^remove$/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /^remove$/i }));

    await waitFor(() => {
      expect(screen.getByText('Feature entitlement removed successfully')).toBeInTheDocument();
      expect(screen.queryByText('Max Users')).not.toBeInTheDocument();
      expect(screen.getByText('Storage Cap')).toBeInTheDocument();
    });
  });
});

describe('PlanFeaturesView — error handling', () => {
  it('shows error toast when the initial load fails', async () => {
    vi.mocked(saasService.getPlanFeatures).mockRejectedValue(new Error('Network failure'));
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  it('shows session-expired toast on SESSION_EXPIRED error', async () => {
    vi.mocked(saasService.getPlanFeatures).mockRejectedValue(new Error('SESSION_EXPIRED'));
    render(<PlanFeaturesView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText(/Session expired/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail with "module not found"**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
npx vitest run src/components/SaaSDashboard/PlanFeaturesView.test.tsx
```

Expected: FAIL — `Cannot find module './PlanFeaturesView'`

- [ ] **Step 3: Commit the failing test file**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
git add src/components/SaaSDashboard/PlanFeaturesView.test.tsx
git commit -m "test: add failing tests for PlanFeaturesView (TDD red phase)"
```

---

### Task 5: Implement `PlanFeaturesView`

**Files:**
- Create: `src/components/SaaSDashboard/PlanFeaturesView.tsx`

**Interfaces:**
- Consumes: `PlanFeature`, `SubscriptionPlan`, `PlatformFeature` from `../../types/subscription`; `saasService.getPlanFeatures`, `saasService.getFeatures`, `saasService.createPlanFeature`, `saasService.updatePlanFeature`, `saasService.deletePlanFeature`
- Produces: exported `PlanFeaturesView` component, `interface PlanFeaturesViewProps { plan: SubscriptionPlan; onNavigate?: (view: string) => void; }`

- [ ] **Step 1: Create the component**

Create `src/components/SaaSDashboard/PlanFeaturesView.tsx`:

```tsx
//src/components/SaaSDashboard/PlanFeaturesView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { saasService } from '../../services/saasService';
import type { PlanFeature, SubscriptionPlan, PlatformFeature } from '../../types/subscription';

interface MapFeatureDialogProps {
  plan: SubscriptionPlan;
  availableFeatures: PlatformFeature[];
  loadingFeatures: boolean;
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { featureId: number; limitValue: number }) => void;
}

const MapFeatureDialog: React.FC<MapFeatureDialogProps> = ({
  plan,
  availableFeatures,
  loadingFeatures,
  submitting,
  onClose,
  onSave,
}) => {
  const [selectedFeatureId, setSelectedFeatureId] = React.useState<number | ''>('');
  const [limitValue, setLimitValue] = React.useState('');

  const parsedLimit = Number(limitValue);
  const limitIsValid = limitValue.trim() !== '' && !Number.isNaN(parsedLimit) && parsedLimit >= 0;
  const isValid = selectedFeatureId !== '' && limitIsValid && !loadingFeatures;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg shadow-2xl">
        <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            MAP FEATURE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
              Subscription Plan
            </label>
            <input
              type="text"
              readOnly
              title="Subscription Plan"
              value={plan.name}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#ece8e0] text-sm text-[#5f5e5e] cursor-not-allowed outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="map-feature-select"
              className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]"
            >
              Feature
            </label>
            <select
              id="map-feature-select"
              value={selectedFeatureId}
              onChange={(e) =>
                setSelectedFeatureId(e.target.value === '' ? '' : Number(e.target.value))
              }
              disabled={loadingFeatures}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] outline-none transition-all disabled:opacity-50"
            >
              {loadingFeatures ? (
                <option value="">Loading features…</option>
              ) : availableFeatures.length === 0 ? (
                <option value="">All features already mapped</option>
              ) : (
                <>
                  <option value="">Select a feature…</option>
                  {availableFeatures.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.Unit})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="map-feature-limit"
              className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]"
            >
              Assigned Cap
            </label>
            <input
              id="map-feature-limit"
              type="number"
              min="0"
              step="0.01"
              value={limitValue}
              onChange={(e) => setLimitValue(e.target.value)}
              placeholder="e.g. 10.00"
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] outline-none transition-all"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 border border-[#e8e2d8] text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                onSave({ featureId: selectedFeatureId as number, limitValue: parsedLimit })
              }
              disabled={!isValid || submitting}
              className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && (
                <span className="material-symbols-outlined text-base animate-spin">
                  progress_activity
                </span>
              )}
              {submitting ? 'Mapping…' : 'MAP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EditPlanFeatureDialogProps {
  pf: PlanFeature;
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { limitValue: number; status: 'active' | 'inactive' }) => void;
}

const EditPlanFeatureDialog: React.FC<EditPlanFeatureDialogProps> = ({
  pf,
  submitting,
  onClose,
  onSave,
}) => {
  const initialStatus: 'active' | 'inactive' = pf.status === 'active' ? 'active' : 'inactive';
  const [limitValue, setLimitValue] = React.useState(String(pf.limit_value));
  const [status, setStatus] = React.useState<'active' | 'inactive'>(initialStatus);

  const parsedLimit = Number(limitValue);
  const limitIsValid = limitValue.trim() !== '' && !Number.isNaN(parsedLimit) && parsedLimit >= 0;
  const noChanges = parsedLimit === pf.limit_value && status === initialStatus;
  const isValid = limitIsValid && !noChanges;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg shadow-2xl">
        <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            EDIT PLAN-FEATURE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
              Subscription Plan
            </label>
            <input
              type="text"
              readOnly
              title="Subscription Plan"
              value={pf.subscriptionPlan.name}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#ece8e0] text-sm text-[#5f5e5e] cursor-not-allowed outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
              Feature
            </label>
            <input
              type="text"
              readOnly
              title="Feature"
              value={pf.feature.name}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#ece8e0] text-sm text-[#5f5e5e] cursor-not-allowed outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="edit-feature-limit"
              className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]"
            >
              Assigned Cap
            </label>
            <input
              id="edit-feature-limit"
              type="number"
              min="0"
              step="0.01"
              value={limitValue}
              onChange={(e) => setLimitValue(e.target.value)}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="edit-feature-status"
              className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]"
            >
              Feature Status
            </label>
            <select
              id="edit-feature-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] outline-none transition-all"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 border border-[#e8e2d8] text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ limitValue: parsedLimit, status })}
              disabled={!isValid || submitting}
              className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && (
                <span className="material-symbols-outlined text-base animate-spin">
                  progress_activity
                </span>
              )}
              {submitting ? 'Saving…' : 'SAVE CHANGES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DeletePlanFeatureDialogProps {
  pf: PlanFeature;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeletePlanFeatureDialog: React.FC<DeletePlanFeatureDialogProps> = ({
  pf,
  submitting,
  onClose,
  onConfirm,
}) => (
  <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md shadow-2xl">
      <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          REMOVE ENTITLEMENT
        </span>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="text-white/50 hover:text-white transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="p-6 space-y-5">
        <p className="text-sm text-[#1d1c17] leading-relaxed">
          Are you sure you want to remove this entitlement? This will unmap{' '}
          <strong>{pf.feature.name}</strong> from <strong>{pf.subscriptionPlan.name}</strong>.
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2 border border-[#e8e2d8] text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && (
              <span className="material-symbols-outlined text-base animate-spin">
                progress_activity
              </span>
            )}
            {submitting ? 'Removing…' : 'REMOVE'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

interface PlanFeaturesViewProps {
  plan: SubscriptionPlan;
  onNavigate?: (view: string) => void;
}

export const PlanFeaturesView: React.FC<PlanFeaturesViewProps> = ({ plan, onNavigate }) => {
  const [planFeatures, setPlanFeatures] = useState<PlanFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showMapModal, setShowMapModal] = useState(false);
  const [availableFeatures, setAvailableFeatures] = useState<PlatformFeature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [mapSubmitting, setMapSubmitting] = useState(false);
  const [editingPF, setEditingPF] = useState<PlanFeature | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deletingPF, setDeletingPF] = useState<PlanFeature | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    saasService
      .getPlanFeatures(plan.id)
      .then(setPlanFeatures)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load plan features';
        setFetchError(true);
        if (msg === 'SESSION_EXPIRED') {
          setToast({
            message: 'Session expired. Please refresh the page to sign in again.',
            type: 'error',
          });
        } else {
          setToast({ message: msg, type: 'error' });
        }
      })
      .finally(() => setLoading(false));
  }, [plan.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const openMapModal = () => {
    setShowMapModal(true);
    setLoadingFeatures(true);
    saasService
      .getFeatures()
      .then((features) => {
        const mappedIds = new Set(planFeatures.map((pf) => pf.feature.id));
        setAvailableFeatures(features.filter((f) => f.status === 'active' && !mappedIds.has(f.id)));
      })
      .catch(() => setAvailableFeatures([]))
      .finally(() => setLoadingFeatures(false));
  };

  const handleMap = async (dto: { featureId: number; limitValue: number }) => {
    setMapSubmitting(true);
    try {
      const newPF = await saasService.createPlanFeature({
        subscriptionPlan: plan.id,
        feature: dto.featureId,
        limit_value: dto.limitValue,
        status: 'active',
      });
      setPlanFeatures((prev) => [newPF, ...prev]);
      setShowMapModal(false);
      setToast({ message: 'Feature mapped successfully', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to map feature';
      setShowMapModal(false);
      if (msg === 'SESSION_EXPIRED') {
        setToast({
          message: 'Session expired. Please refresh the page to sign in again.',
          type: 'error',
        });
      } else {
        setToast({ message: msg, type: 'error' });
      }
    } finally {
      setMapSubmitting(false);
    }
  };

  const handleEdit = async (dto: { limitValue: number; status: 'active' | 'inactive' }) => {
    setEditSubmitting(true);
    try {
      const updated = await saasService.updatePlanFeature(editingPF!.id, {
        limit_value: dto.limitValue,
        status: dto.status,
      });
      setPlanFeatures((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPF(null);
      setToast({ message: 'Plan-feature updated successfully', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update plan-feature';
      setEditingPF(null);
      if (msg === 'SESSION_EXPIRED') {
        setToast({
          message: 'Session expired. Please refresh the page to sign in again.',
          type: 'error',
        });
      } else {
        setToast({ message: msg, type: 'error' });
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPF) return;
    setDeleteSubmitting(true);
    try {
      await saasService.deletePlanFeature(deletingPF.id);
      setPlanFeatures((prev) => prev.filter((p) => p.id !== deletingPF.id));
      setDeletingPF(null);
      setToast({ message: 'Feature entitlement removed successfully', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove feature entitlement';
      setDeletingPF(null);
      if (msg === 'SESSION_EXPIRED') {
        setToast({
          message: 'Session expired. Please refresh the page to sign in again.',
          type: 'error',
        });
      } else {
        setToast({ message: msg, type: 'error' });
      }
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filteredFeatures = useMemo(() => {
    const term = searchQuery.toLowerCase();
    return planFeatures.filter((pf) => {
      const matchesSearch = !term || pf.feature.name.toLowerCase().includes(term);
      const matchesStatus = !statusFilter || pf.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [planFeatures, searchQuery, statusFilter]);

  const isFilteredEmpty =
    !loading && !fetchError && planFeatures.length > 0 && filteredFeatures.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Dark Title Banner (AC2) */}
      <div className="bg-[#222222] px-6 py-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          FEATURE ENTITLEMENTS BOUND TO PLAN: {plan.name}
        </span>
      </div>

      {/* Empty State (AC4) */}
      {!loading && !fetchError && planFeatures.length === 0 && (
        <div
          data-testid="empty-state"
          className="flex flex-col items-center justify-center py-24 gap-6"
        >
          <span className="material-symbols-outlined text-[#5f5e5e] text-[72px]">tune</span>
          <div className="text-center">
            <h3 className="text-xl font-bold text-[#1d1c17]">No Features Mapped</h3>
            <p className="text-sm text-[#5f5e5e] mt-2 max-w-md text-center">
              This subscription plan currently has no features or limits mapped.
              Click &apos;Map Feature&apos; to establish your first entitlement rule.
            </p>
          </div>
          <button
            type="button"
            onClick={openMapModal}
            className="px-5 py-2.5 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add_link</span>
            MAP FEATURE
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription')}
            className="text-[#ae001a] text-sm font-semibold hover:underline"
          >
            ← Back to Subscription Plans
          </button>
        </div>
      )}

      {/* Table */}
      {(loading || planFeatures.length > 0) && (
        <div className="bg-white border border-[#e8e2d8] overflow-hidden">
          <div className="px-4 py-3 bg-[#222222] flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white">
              BOUND FEATURES
            </span>
            <span className="text-white/50 text-xs">
              {loading ? '...' : `${planFeatures.length} entries`}
            </span>
          </div>

          {!loading && (
            <div className="px-4 py-3 border-b border-[#e8e2d8] bg-[#f8f3eb] flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search by feature name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[#e8e2d8] bg-white text-[#1d1c17] placeholder:text-[#5f5e5e] focus:outline-none focus:border-[#ae001a]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="pf-status-filter"
                  className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] whitespace-nowrap"
                >
                  Entitlement Status
                </label>
                <select
                  id="pf-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm border border-[#e8e2d8] bg-white text-[#1d1c17] px-3 py-2 focus:outline-none focus:border-[#ae001a]"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <button
                type="button"
                onClick={openMapModal}
                className="px-4 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-base">add_link</span>
                MAP FEATURE
              </button>
            </div>
          )}

          {isFilteredEmpty && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="material-symbols-outlined text-[#5f5e5e] text-[48px]">
                filter_alt_off
              </span>
              <p className="text-sm font-semibold text-[#5f5e5e]">
                No feature entitlements match your active filters
              </p>
            </div>
          )}

          {!isFilteredEmpty && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                      Feature Identity
                    </th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                      Measurement Unit
                    </th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                      Assigned Cap
                    </th>
                    <th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                      Entitlement Status
                    </th>
                    <th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e2d8]">
                  {loading
                    ? [1, 2, 3].map((i) => (
                        <tr key={i}>
                          <td className="px-6 py-4">
                            <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-40" />
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-16" />
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-20 ml-auto" />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-14 mx-auto" />
                          </td>
                          <td className="px-6 py-4" />
                        </tr>
                      ))
                    : filteredFeatures.map((pf) => (
                        <tr key={pf.id} className="group hover:bg-[#f8f3eb] transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-[#1d1c17]">{pf.feature.name}</p>
                            <code className="font-mono text-[11px] text-[#5f5e5e] bg-[#f2ede5] px-1.5 py-0.5 rounded">
                              {pf.feature.id}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs text-[#5f5e5e]">
                              [{pf.feature.unit}]
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-semibold text-[#1d1c17]">
                              {Number(pf.limit_value).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {pf.status === 'active' ? (
                              <span className="bg-green-500/10 text-green-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                                active
                              </span>
                            ) : (
                              <span className="bg-[#5f5e5e]/20 text-[#5f5e5e] text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                                inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                aria-label={`Edit ${pf.feature.name}`}
                                onClick={() => setEditingPF(pf)}
                                className="text-[#5f5e5e] hover:text-[#ae001a] transition-colors"
                              >
                                <span className="material-symbols-outlined text-[20px]">edit</span>
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${pf.feature.name}`}
                                onClick={() => setDeletingPF(pf)}
                                className="text-[#5f5e5e] hover:text-red-600 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quick Launch */}
      <div className="bg-[#2a2a2a] rounded-xl p-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h3 className="!text-white font-bold text-base">Quick Launch</h3>
          <p className="text-white/60 text-sm">Navigation shortcuts for plan management.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate?.('subscription')}
            className="bg-white text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest px-6 py-3 border-b-4 border-[#ae001a] hover:-translate-y-0.5 transition-transform"
          >
            SUBSCRIPTION PLANS
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription-applications')}
            className="bg-white text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest px-6 py-3 border-b-4 border-[#ae001a] hover:-translate-y-0.5 transition-transform"
          >
            PLATFORM APPLICATIONS
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription-features')}
            className="bg-white text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest px-6 py-3 border-b-4 border-[#ae001a] hover:-translate-y-0.5 transition-transform"
          >
            FEATURE CATALOG
          </button>
          <button
            type="button"
            className="bg-[#ae001a] text-white text-[11px] font-bold uppercase tracking-widest px-6 py-3 rounded hover:bg-[#930015] hover:-translate-y-0.5 transition-all"
          >
            EMERGENCY SUPPORT
          </button>
        </div>
      </div>

      {/* Footer (AC1) */}
      <footer className="flex flex-col md:flex-row justify-between items-center border-t border-[#e8e2d8] pt-5 mt-2 mb-8">
        <button
          type="button"
          onClick={() => onNavigate?.('subscription')}
          className="text-[11px] font-bold uppercase tracking-widest text-[#ae001a] hover:underline flex items-center gap-1"
        >
          ← Back to Subscription Plans
        </button>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mt-3 md:mt-0">
          © 2026 X7 Point of Sale. All rights reserved.
        </p>
      </footer>

      {/* FAB */}
      {!fetchError && (
        <button
          type="button"
          aria-label="Open map-feature form"
          onClick={openMapModal}
          className="fixed bottom-8 right-8 w-14 h-14 bg-[#ae001a] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#930015] transition-all transform hover:scale-110 active:scale-95 z-50"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      )}

      {/* Modals */}
      {showMapModal && (
        <MapFeatureDialog
          plan={plan}
          availableFeatures={availableFeatures}
          loadingFeatures={loadingFeatures}
          submitting={mapSubmitting}
          onClose={() => setShowMapModal(false)}
          onSave={handleMap}
        />
      )}
      {editingPF && (
        <EditPlanFeatureDialog
          pf={editingPF}
          submitting={editSubmitting}
          onClose={() => setEditingPF(null)}
          onSave={handleEdit}
        />
      )}
      {deletingPF && (
        <DeletePlanFeatureDialog
          pf={deletingPF}
          submitting={deleteSubmitting}
          onClose={() => setDeletingPF(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanFeaturesView;
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
npx vitest run src/components/SaaSDashboard/PlanFeaturesView.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
git add src/components/SaaSDashboard/PlanFeaturesView.tsx
git commit -m "feat: implement PlanFeaturesView with map/edit/delete CRUD"
```

---

### Task 6: Wire shell — `SaaSDashboard` + `SubscriptionPlansView` navigation

**Files:**
- Modify: `src/components/SaaSDashboard/SaaSDashboard.tsx`
- Modify: `src/components/SaaSDashboard/SubscriptionPlansView.tsx`

**Interfaces:**
- Consumes: `PlanFeaturesView` (from Task 5); `handleNavigateView(view, plan?)` (already exists, generalized by the earlier Plan Applications work)
- Produces: clicking the `tune` icon on a plan row navigates to `subscription-plan-features` and renders `PlanFeaturesView` with the selected plan; breadcrumb reads `SaaS Admin › Subscription Architecture › Plan Features`

- [ ] **Step 1: Update `SaaSDashboard.tsx`**

**1a — Add the import** (after the `PlanApplicationsView` import, currently line 11):

```ts
import { PlanFeaturesView } from './PlanFeaturesView';
```

**1b — Replace the breadcrumb condition block.** Replace (currently lines 343-366):

```tsx
              {(activeTab === 'subscription-applications' ||
              activeTab === 'subscription-live-installs' ||
              activeTab === 'subscription-features' ||
              activeTab === 'subscription-plan-applications') && (
                <nav className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1">
                  <span>SaaS Admin</span>
                  <span className="text-[#d51f2c]">›</span>
                  <span>
                    {activeTab === 'subscription-plan-applications'
                      ? 'Subscription Architecture'
                      : 'Platform Architecture'}
                  </span>
                  <span className="text-[#d51f2c]">›</span>
                  <span className="text-[#1d1c17]">
                    {activeTab === 'subscription-plan-applications'
                      ? 'Plan Applications'
                      : activeTab === 'subscription-applications'
                        ? 'Applications'
                        : activeTab === 'subscription-live-installs'
                          ? 'Live Installs'
                          : 'Feature Catalog'}
                  </span>
                </nav>
              )}
```

With:

```tsx
              {(activeTab === 'subscription-applications' ||
              activeTab === 'subscription-live-installs' ||
              activeTab === 'subscription-features' ||
              activeTab === 'subscription-plan-applications' ||
              activeTab === 'subscription-plan-features') && (
                <nav className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1">
                  <span>SaaS Admin</span>
                  <span className="text-[#d51f2c]">›</span>
                  <span>
                    {activeTab === 'subscription-plan-applications' ||
                    activeTab === 'subscription-plan-features'
                      ? 'Subscription Architecture'
                      : 'Platform Architecture'}
                  </span>
                  <span className="text-[#d51f2c]">›</span>
                  <span className="text-[#1d1c17]">
                    {activeTab === 'subscription-plan-applications'
                      ? 'Plan Applications'
                      : activeTab === 'subscription-plan-features'
                        ? 'Plan Features'
                        : activeTab === 'subscription-applications'
                          ? 'Applications'
                          : activeTab === 'subscription-live-installs'
                            ? 'Live Installs'
                            : 'Feature Catalog'}
                  </span>
                </nav>
              )}
```

**1c — Add `subscription-plan-features` to the h1 ternary chain.** Replace (currently lines 367-377):

```tsx
              <h1 className="font-sans text-h1 text-[#222222] uppercase tracking-tighter">
                Platform SaaS <span className="text-[#d51f2c]">/</span>{' '}
                {activeTab === 'dashboard' ? 'Overview'
                  : activeTab === 'subscription' ? 'Subscription Plans'
                  : activeTab === 'subscription-applications' ? 'Applications'
                  : activeTab === 'subscription-features' ? 'Feature Catalog'
                  : activeTab === 'subscription-payments' ? 'Payments'
                  : activeTab === 'subscription-live-installs' ? 'Live Installs'
                  : activeTab === 'subscription-plan-applications' ? 'Plan Applications'
                  : activeTab}
              </h1>
```

With:

```tsx
              <h1 className="font-sans text-h1 text-[#222222] uppercase tracking-tighter">
                Platform SaaS <span className="text-[#d51f2c]">/</span>{' '}
                {activeTab === 'dashboard' ? 'Overview'
                  : activeTab === 'subscription' ? 'Subscription Plans'
                  : activeTab === 'subscription-applications' ? 'Applications'
                  : activeTab === 'subscription-features' ? 'Feature Catalog'
                  : activeTab === 'subscription-payments' ? 'Payments'
                  : activeTab === 'subscription-live-installs' ? 'Live Installs'
                  : activeTab === 'subscription-plan-applications' ? 'Plan Applications'
                  : activeTab === 'subscription-plan-features' ? 'Plan Features'
                  : activeTab}
              </h1>
```

**1d — Add the description case.** Replace (currently lines 378-394):

```tsx
              <p className="text-body-md text-[#666666] mt-1">
                {activeTab === 'dashboard'
                  ? 'Real-time performance metrics and merchant growth tracking.'
                  : activeTab === 'subscription'
                    ? 'Manage subscription tiers, pricing models, and billing cadences for your platform.'
                    : activeTab === 'subscription-applications'
                      ? 'Manage software ecosystems and applications linked to subscription plans.'
                      : activeTab === 'subscription-features'
                        ? 'Configure master feature flags and platform capability tables.'
                        : activeTab === 'subscription-payments'
                          ? 'Track payment logs and incoming cash movements from active merchants.'
                          : activeTab === 'subscription-live-installs'
                            ? 'Monitor live merchant profiles mapped to individual applications.'
                            : activeTab === 'subscription-plan-applications'
                              ? `Applications bundled into the "${selectedPlan?.name}" subscription tier.`
                              : `Visualización interactiva y gestión para /${activeTab}.`}
              </p>
```

With:

```tsx
              <p className="text-body-md text-[#666666] mt-1">
                {activeTab === 'dashboard'
                  ? 'Real-time performance metrics and merchant growth tracking.'
                  : activeTab === 'subscription'
                    ? 'Manage subscription tiers, pricing models, and billing cadences for your platform.'
                    : activeTab === 'subscription-applications'
                      ? 'Manage software ecosystems and applications linked to subscription plans.'
                      : activeTab === 'subscription-features'
                        ? 'Configure master feature flags and platform capability tables.'
                        : activeTab === 'subscription-payments'
                          ? 'Track payment logs and incoming cash movements from active merchants.'
                          : activeTab === 'subscription-live-installs'
                            ? 'Monitor live merchant profiles mapped to individual applications.'
                            : activeTab === 'subscription-plan-applications'
                              ? `Applications bundled into the "${selectedPlan?.name}" subscription tier.`
                              : activeTab === 'subscription-plan-features'
                                ? `Feature entitlements and quantitative limits bundled into the "${selectedPlan?.name}" subscription tier.`
                                : `Visualización interactiva y gestión para /${activeTab}.`}
              </p>
```

**1e — Add the new case to `renderContent`.** Insert right after the existing `subscription-plan-applications` block (currently lines 93-100):

```ts
    if (activeTab === 'subscription-plan-features' && selectedPlan) {
      return (
        <PlanFeaturesView
          plan={selectedPlan}
          onNavigate={handleNavigateView}
        />
      );
    }
```

- [ ] **Step 2: Update `SubscriptionPlansView.tsx` — `tune` button**

Add a "View Features" icon button in the Actions column, right after the existing `grid_view` button and before the edit button (currently lines 447-457):

```tsx
                        {plan.status !== 'deleted' && (
                          <button
                            type="button"
                            aria-label={`View features for ${plan.name}`}
                            onClick={() => onNavigate?.('subscription-plan-features', plan)}
                            className="p-1 hover:text-[#ae001a] transition-colors"
                          >
                            <span className="material-symbols-outlined text-xl">tune</span>
                          </button>
                        )}
```

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
npx vitest run
```

Expected: all tests pass, including the new `PlanFeaturesView.test.tsx` suite. If `SubscriptionPlansView.test.tsx` renders the Actions column, verify no regressions.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
git add src/components/SaaSDashboard/SaaSDashboard.tsx
git add src/components/SaaSDashboard/SubscriptionPlansView.tsx
git commit -m "feat: wire PlanFeaturesView into shell navigation and SubscriptionPlansView row actions"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Backend `subscriptionPlanId` filter | Task 1 |
| Backend `feature.unit` in `findAll` response | Task 1 |
| Backend `update()` persists `status` | Task 2 |
| `PlanFeature`/`CreatePlanFeatureDto`/`UpdatePlanFeatureDto` types | Task 3 |
| `getPlanFeatures`/`createPlanFeature`/`updatePlanFeature`/`deletePlanFeature` service methods | Task 3 |
| AC1: sidebar/breadcrumbs `SaaS Admin > Subscription Architecture > Plan Features`/footer | Task 6 (breadcrumbs), Task 5 (footer inside component) |
| AC2: dark title banner `FEATURE ENTITLEMENTS BOUND TO PLAN: [Plan_Name]` | Task 5 |
| AC3: Feature Identity (name + id badge), Measurement Unit (bracketed), Assigned Cap (2 decimals), Entitlement Status (emerald/grey badge) | Task 5, tested in Task 4 |
| AC4: empty state hides table, exact copy | Task 5, tested in Task 4 |
| Map Feature flow (create, excludes already-mapped features) | Task 5, tested in Task 4 |
| Edit flow (limit_value + status) | Task 5, tested in Task 4 |
| Delete flow (soft-delete, row removed) | Task 5, tested in Task 4 |
| Search/status filter | Task 5, tested in Task 4 |
| Navigation from plan row (`tune` icon) | Task 6 |
| Error/SESSION_EXPIRED handling | Task 5, tested in Task 4 |

All requirements covered. No gaps.

**Placeholder scan:** No TBD, TODO, or vague steps found. Every step has complete code.

**Type consistency:**
- `PlanFeature.feature.unit` (lowercase) — defined in Task 3, produced by backend mapping in Task 1 (`unit: item.feature.Unit`), consumed in Task 5 render (`pf.feature.unit`) and Task 4 test mocks ✓
- `PlatformFeature.Unit` (uppercase, pre-existing type) — used only for the Map Feature dropdown catalog list in Task 5 (`f.Unit`), distinct from `PlanFeature.feature.unit` — no collision since they're different interfaces ✓
- `saasService.getPlanFeatures(plan.id)` — defined in Task 3, called in Task 5 `useEffect` ✓
- `saasService.createPlanFeature({ subscriptionPlan, feature, limit_value, status })` — DTO shape defined in Task 3, constructed in Task 5 `handleMap` ✓
- `saasService.updatePlanFeature(id, { limit_value, status })` — DTO shape defined in Task 3, constructed in Task 5 `handleEdit` ✓
- `data-testid="empty-state"` — used in Task 4 test, rendered in Task 5 component ✓
- `handleNavigateView(view: string, plan?: SubscriptionPlan)` — already exists from prior Plan Applications work, reused unchanged in Task 6 ✓
- Aria-labels `Edit ${pf.feature.name}` / `Remove ${pf.feature.name}` — defined in Task 5, matched by regex in Task 4 tests (`/edit max users/i`, `/remove max users/i`) ✓
