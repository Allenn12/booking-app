/**
 * TemplateEngine handles the replacement of variables inside SMS messages.
 */
export const TemplateEngine = {
    render: (template, data) => {
        if (!template) return '';
        
        let result = template;
        
        // Map the allowed variables to the provided data payload
        const replacements = {
            '{ime}': data.clientName || 'Klijent',
            '{vrijeme}': data.time || 'nepoznato vrijeme',
            '{usluga}': data.serviceName || 'usluga',
            '{radnik}': data.employeeName || 'naš djelatnik',
            '{biznis}': data.businessName || 'salon'
        };

        for (const [key, value] of Object.entries(replacements)) {
            // Use replaceAll to replace multiple occurrences if they exist
            result = result.replaceAll(key, value);
        }

        return result;
    }
};

export default TemplateEngine;
