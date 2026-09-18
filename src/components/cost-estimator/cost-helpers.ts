import type { CostLineItem, CostPayment, CostCategory, CostPackage, ProjectCostData } from '@/repositories/cost-repo';

export function lineItemBudget(item: CostLineItem) {
  if (item.is_lump_sum) {
    return {
      material: Number(item.material_lump) || 0,
      labour: Number(item.labour_lump) || 0,
      workContract: Number(item.work_contract_lump) || 0,
    };
  }
  const qty = Number(item.quantity) || 0;
  return {
    material: qty * (Number(item.material_rate) || 0),
    labour: qty * (Number(item.labour_rate) || 0),
    workContract: qty * (Number(item.work_contract_rate) || 0),
  };
}

export function lineItemTotal(item: CostLineItem): number {
  const b = lineItemBudget(item);
  return b.material + b.labour + b.workContract;
}

export interface CategorySummary {
  category: CostCategory;
  materialBudget: number;
  labourBudget: number;
  workContractBudget: number;
  totalBudget: number;
  materialPaid: number;
  labourPaid: number;
  workContractPaid: number;
  totalPaid: number;
  remaining: number;
}

export interface PackageSummary {
  pkg: CostPackage;
  categories: CategorySummary[];
  totalBudget: number;
  totalPaid: number;
  remaining: number;
}

export function computeSummaries(data: ProjectCostData, excludedItemIds: Set<string>): {
  packageSummaries: PackageSummary[];
  grandTotalBudget: number;
  grandTotalPaid: number;
  grandRemaining: number;
  materialBudget: number;
  labourBudget: number;
  workContractBudget: number;
} {
  let grandTotalBudget = 0;
  let grandTotalPaid = 0;
  let materialBudgetTotal = 0;
  let labourBudgetTotal = 0;
  let workContractBudgetTotal = 0;

  const packageSummaries: PackageSummary[] = data.packages.map(pkg => {
    const pkgCategories = data.categories.filter(c => c.package_id === pkg.id);
    let pkgBudget = 0;
    let pkgPaid = 0;

    const categories: CategorySummary[] = pkgCategories.map(cat => {
      const items = data.lineItems.filter(
        li => li.category_id === cat.id && li.is_active && !excludedItemIds.has(li.id),
      );
      const payments = data.payments.filter(p => p.category_id === cat.id);

      let materialBudget = 0;
      let labourBudget = 0;
      let workContractBudget = 0;

      for (const item of items) {
        const b = lineItemBudget(item);
        materialBudget += b.material;
        labourBudget += b.labour;
        workContractBudget += b.workContract;
      }

      let materialPaid = 0;
      let labourPaid = 0;
      let workContractPaid = 0;

      for (const p of payments) {
        const amt = Number(p.amount) || 0;
        if (p.cost_type === 'material') materialPaid += amt;
        else if (p.cost_type === 'labour') labourPaid += amt;
        else workContractPaid += amt;
      }

      const totalBudget = materialBudget + labourBudget + workContractBudget;
      const totalPaid = materialPaid + labourPaid + workContractPaid;

      pkgBudget += totalBudget;
      pkgPaid += totalPaid;
      materialBudgetTotal += materialBudget;
      labourBudgetTotal += labourBudget;
      workContractBudgetTotal += workContractBudget;

      return {
        category: cat,
        materialBudget,
        labourBudget,
        workContractBudget,
        totalBudget,
        materialPaid,
        labourPaid,
        workContractPaid,
        totalPaid,
        remaining: totalBudget - totalPaid,
      };
    });

    grandTotalBudget += pkgBudget;
    grandTotalPaid += pkgPaid;

    return {
      pkg,
      categories,
      totalBudget: pkgBudget,
      totalPaid: pkgPaid,
      remaining: pkgBudget - pkgPaid,
    };
  });

  return {
    packageSummaries,
    grandTotalBudget,
    grandTotalPaid,
    grandRemaining: grandTotalBudget - grandTotalPaid,
    materialBudget: materialBudgetTotal,
    labourBudget: labourBudgetTotal,
    workContractBudget: workContractBudgetTotal,
  };
}

export function formatINR(amount: number): string {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(2)} L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatINRFull(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}
