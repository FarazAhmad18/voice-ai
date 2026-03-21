import { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

const FirmContext = createContext(null);

/**
 * Provides firm config + industry labels to all components.
 * Reads from AuthContext (fetched on login via /api/auth/me).
 */
export function FirmProvider({ children }) {
  const { firm, industryConfig } = useAuth();

  // Dynamic labels based on industry config
  const labels = {
    lead: industryConfig?.lead_label || 'Leads',
    case: industryConfig?.case_label || 'Case Type',
    staff: industryConfig?.staff_label || 'Staff',
    caseTypes: (() => {
      try {
        const types = industryConfig?.case_types;
        if (Array.isArray(types)) return types;
        if (typeof types === 'string') return JSON.parse(types);
        return ['other'];
      } catch {
        return ['other'];
      }
    })(),
  };

  const value = {
    firm,
    labels,
    brandColor: firm?.brand_color || '#6d28d9',
    industry: firm?.industry || 'other',
    firmName: firm?.name || 'Dashboard',
    agentName: firm?.agent_name || 'AI Assistant',
  };

  return (
    <FirmContext.Provider value={value}>
      {children}
    </FirmContext.Provider>
  );
}

export function useFirm() {
  return useContext(FirmContext) || { labels: { lead: 'Leads', case: 'Case Type', staff: 'Staff', caseTypes: [] }, brandColor: '#6d28d9' };
}
