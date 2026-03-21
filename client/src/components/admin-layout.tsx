import "@shopify/polaris/build/esm/styles.css";
import { AppProvider } from "@shopify/polaris";
import type { LinkLikeComponentProps } from "@shopify/polaris/build/ts/src/utilities/link/types";
import enTranslations from "@shopify/polaris/locales/en.json";
import { NavMenu } from "@shopify/app-bridge-react";
import { Link } from "wouter";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AppProvider i18n={enTranslations} linkComponent={WouterLink}>
      <NavMenu>
        <a href="/admin/bundles" rel="home">Bundles</a>
        <a href="/analytics">Analytics</a>
        <a href="/settings">Settings</a>
        <a href="/billing">Pricing</a>
        <a href="/support">Support</a>
      </NavMenu>
      {children}
    </AppProvider>
  );
}

function WouterLink({ children, url, external, download, ...rest }: LinkLikeComponentProps) {
  if (external) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" download={download} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={url} {...(rest as Record<string, unknown>)}>
      {children}
    </Link>
  );
}
