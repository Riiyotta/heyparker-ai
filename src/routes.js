// One entry per captured page (same routes as ia.json). html/body: the attributes the page's CSS depends on.
export const routes = [
  { path: "/", template: "template.home", title: "Parker", html: {"lang":"en-US","class":"lenis lenis-autoToggle"}, body: {}, load: () => import("./pages/Home.jsx") },
  { path: "/support/terms-of-service", template: "template.support", title: "Terms of Service - Parker", html: {"lang":"en-US","class":"lenis lenis-autoToggle"}, body: {}, load: () => import("./pages/SupportTermsOfService.jsx") },
  { path: "/support/privacy-policy", template: "template.support", title: "Privacy Policy - Parker", html: {"lang":"en-US","class":"lenis lenis-autoToggle"}, body: {}, load: () => import("./pages/SupportPrivacyPolicy.jsx") },
  { path: "/support/data-deletion-request", template: "template.support", title: "Data Deletion Request - Parker", html: {"lang":"en-US","class":"lenis lenis-autoToggle"}, body: {}, load: () => import("./pages/SupportDataDeletionRequest.jsx") },
];
