import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminHome from "@/pages/admin-home";
import AdminBundles from "@/pages/admin-bundles";
import AdminBundleForm from "@/pages/admin-bundle-form";
import BundleBuilder from "@/pages/bundle-builder";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AdminHome} />
      <Route path="/admin/bundles/new" component={AdminBundleForm} />
      <Route path="/admin/bundles/:id" component={AdminBundleForm} />
      <Route path="/admin/bundles" component={AdminBundles} />
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
