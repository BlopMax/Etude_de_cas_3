import helmet from 'helmet';

// Ajoute les en-têtes de sécurité HTTP et enlève X-Powered-By
export const securityHeaders = helmet();
