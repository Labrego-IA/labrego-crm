export const leadSourceOptions = [
  { value: 'Facebook', label: 'Facebook', icon: '/lead-sources/facebook.svg' },
  { value: 'Instagram', label: 'Instagram', icon: '/lead-sources/instagram.svg' },
  { value: 'WhatsApp', label: 'WhatsApp', icon: '/lead-sources/whatsapp.svg' },
  { value: 'LinkedIn', label: 'LinkedIn', icon: '/lead-sources/linkedin.svg' },
  { value: 'Indicação', label: 'Indicação', icon: '/lead-sources/indication.svg' },
  { value: 'CNPJ biz', label: 'CNPJ biz', icon: '/lead-sources/cnpj-biz.svg' },
  { value: 'Outros', label: 'Outros', icon: '/lead-sources/others.svg' },
] as const;

// Lead Type Options (Inbound/Outbound)
export const leadTypeOptions = [
  { value: 'Inbound', label: 'Inbound', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'Outbound', label: 'Outbound', color: 'bg-blue-100 text-blue-700 border-blue-200' },
] as const;

export type LeadType = typeof leadTypeOptions[number]['value'];

export const leadSourceIcons = leadSourceOptions.reduce<Record<string, string>>(
  (acc, opt) => {
    acc[opt.value] = opt.icon;
    return acc;
  },
  {}
);
