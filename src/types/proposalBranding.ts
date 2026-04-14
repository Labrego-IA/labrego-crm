export interface ProposalBranding {
  companyName: string
  tagline: string
  phone: string
  email: string
  website: string
  instagram: string
  logoUrl: string
  watermarkUrl: string
  primaryColor: string
  presentationText: string
  missionText: string
  showLogosPage: boolean
  showPresentationPage: boolean
  validityDays: number
}

export const DEFAULT_PROPOSAL_BRANDING: ProposalBranding = {
  companyName: '',
  tagline: '',
  phone: '',
  email: '',
  website: '',
  instagram: '',
  logoUrl: '',
  watermarkUrl: '',
  primaryColor: '#06B6D4',
  presentationText: '',
  missionText: '',
  showLogosPage: true,
  showPresentationPage: true,
  validityDays: 7,
}
