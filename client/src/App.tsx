import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminBundles from "@/pages/admin-bundles";
import AdminBundleForm from "@/pages/admin-bundle-form";
import BundleBuilder from "@/pages/bundle-builder";
import BillingPage from "@/pages/billing";
import SupportPage from "@/pages/support";
import AnalyticsPage from "@/pages/analytics";
import SettingsPage from "@/pages/settings-stub";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/admin/bundles" />
      </Route>
      <Route path="/admin/bundles/new" component={AdminBundleForm} />
      <Route path="/admin/bundles/:id" component={AdminBundleForm} />
      <Route path="/admin/bundles" component={AdminBundles} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/bundle-preview" component={BundleBuilder} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
