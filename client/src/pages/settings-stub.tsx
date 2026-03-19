import AdminLayout from "@/components/admin-layout";
import {
  Page,
  Card,
  Text,
  BlockStack,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function SettingsPage() {
  return (
    <AdminLayout>
      <Page>
        <TitleBar title="Settings" />
        <Card>
          <EmptyState
            heading="Theme customization coming soon"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <BlockStack gap="200">
              <Text as="p" tone="subdued">
                Button colors, theme colors, border colors, font colors, sticky cart colors, progress bar colors, and custom CSS will be configurable here.
              </Text>
              <Text as="p" tone="subdued">
                Settings are saved per-shop and applied automatically to your storefront bundle widget.
              </Text>
            </BlockStack>
          </EmptyState>
        </Card>
      </Page>
    </AdminLayout>
  );
}
