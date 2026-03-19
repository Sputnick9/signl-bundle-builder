import "@shopify/polaris/build/esm/styles.css";
import { AppProvider, Frame, Navigation, TopBar, Text, Box } from "@shopify/polaris";
import type { LinkLikeComponentProps } from "@shopify/polaris/build/ts/src/utilities/link/types";
import enTranslations from "@shopify/polaris/locales/en.json";
import {
  ProductIcon,
  ChartVerticalIcon,
  SettingsIcon,
  PaymentIcon,
  QuestionCircleIcon,
} from "@shopify/polaris-icons";
import { NavMenu } from "@shopify/app-bridge-react";
import { useLocation, Link } from "wouter";
import { useState, useCallback } from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const APP_NAME = "SiGNL Bundle Builder";

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [mobileNavActive, setMobileNavActive] = useState(false);

  const toggleMobileNav = useCallback(
    () => setMobileNavActive((v) => !v),
    []
  );

  const contextControl = (
    <Box paddingInlineStart="400">
      <Text as="p" variant="headingSm" fontWeight="semibold">
        {APP_NAME}
      </Text>
    </Box>
  );

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      onNavigationToggle={toggleMobileNav}
      contextControl={contextControl}
    />
  );

  const navigationMarkup = (
    <Navigation location={location}>
      <Navigation.Section
        items={[
          {
            url: "/admin/bundles",
            label: "Bundles",
            icon: ProductIcon,
            selected: location === "/admin/bundles" || location.startsWith("/admin/bundles"),
          },
          {
            url: "/analytics",
            label: "Analytics",
            icon: ChartVerticalIcon,
            selected: location === "/analytics",
          },
          {
            url: "/settings",
            label: "Settings",
            icon: SettingsIcon,
            selected: location === "/settings",
          },
          {
            url: "/billing",
            label: "Pricing",
            icon: PaymentIcon,
            selected: location === "/billing",
          },
          {
            url: "/support",
            label: "Support",
            icon: QuestionCircleIcon,
            selected: location === "/support",
          },
        ]}
      />
    </Navigation>
  );

  return (
    <AppProvider i18n={enTranslations} linkComponent={WouterLink}>
      <NavMenu>
        <a href="/admin/bundles" rel="home">Bundles</a>
        <a href="/analytics">Analytics</a>
        <a href="/settings">Settings</a>
        <a href="/billing">Pricing</a>
        <a href="/support">Support</a>
      </NavMenu>
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
