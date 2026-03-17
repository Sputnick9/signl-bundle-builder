import "@shopify/polaris/build/esm/styles.css";
import { AppProvider, Frame, Navigation, TopBar } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { HomeIcon, ProductIcon, SettingsIcon } from "@shopify/polaris-icons";
import { useLocation, Link } from "wouter";
import { useState, useCallback } from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [mobileNavActive, setMobileNavActive] = useState(false);

  const toggleMobileNav = useCallback(
    () => setMobileNavActive((v) => !v),
    []
  );

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      onNavigationToggle={toggleMobileNav}
    />
  );

  const navigationMarkup = (
    <Navigation location={location}>
      <Navigation.Section
        items={[
          {
            url: "/",
            label: "Dashboard",
            icon: HomeIcon,
            selected: location === "/",
          },
          {
            url: "/admin/bundles",
            label: "Bundles",
            icon: ProductIcon,
            selected: location.startsWith("/admin/bundles"),
          },
        ]}
      />
      <Navigation.Section
        title="Settings"
        items={[
          {
            url: "/admin/settings",
            label: "App Settings",
            icon: SettingsIcon,
            selected: location === "/admin/settings",
            disabled: true,
          },
        ]}
      />
    </Navigation>
  );

  return (
    <AppProvider i18n={enTranslations} linkComponent={WouterLink}>
      <Frame
        topBar={topBarMarkup}
        navigation={navigationMarkup}
        showMobileNavigation={mobileNavActive}
        onNavigationDismiss={toggleMobileNav}
      >
        {children}
      </Frame>
    </AppProvider>
  );
}

function WouterLink({ children, url, ...rest }: { children: React.ReactNode; url: string; [key: string]: any }) {
  return (
    <Link href={url} {...rest}>
      {children}
    </Link>
  );
}
