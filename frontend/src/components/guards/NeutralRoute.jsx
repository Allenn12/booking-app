/**
 * NeutralRoute Guard
 * 
 * PURPOSE: Routes accessible to EVERYONE regardless of auth status
 * 
 * EXAMPLES: /verify-email (user needs to see this whether logged in or not)
 * 
 * LOGIC: Just render children, no redirects!
 */
function NeutralRoute({ children }) {
  // No auth checks, no redirects - just render!
  return children;
}

export default NeutralRoute;