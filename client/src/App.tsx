import { Switch, Route } from "wouter";
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
import { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "32px", fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#d72c0d" }}>Something went wrong</h2>
          <p style={{ color: "#6d7175" }}>{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AdminBundles} />
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
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
