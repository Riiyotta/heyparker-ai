// Breakpoint variants: route -> page for each variant (see qa/clone/export-variant.mjs). main.jsx picks one by media query.
export const variants = {
  "mobile:/": () => import("./pages/HomeMobile.jsx"),
  "mobile:/support/terms-of-service": () => import("./pages/SupportTermsOfServiceMobile.jsx"),
  "mobile:/support/privacy-policy": () => import("./pages/SupportPrivacyPolicyMobile.jsx"),
  "mobile:/support/data-deletion-request": () => import("./pages/SupportDataDeletionRequestMobile.jsx"),
};
