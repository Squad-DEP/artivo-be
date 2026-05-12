export const squadConfig = {
    baseUrl: process.env.SQUAD_BASE_URL || 'https://sandbox-api-d.squadco.com',
    secretKey: process.env.SQUAD_SECRET_KEY || '',
    isProduction: process.env.NODE_ENV === 'production',
};

// Validate Squad configuration
export const validateSquadConfig = (): boolean => {
    if (!squadConfig.secretKey) {
        console.warn('⚠️  SQUAD_SECRET_KEY not set! Virtual account creation will fail.');
        return false;
    }
    return true;
};
