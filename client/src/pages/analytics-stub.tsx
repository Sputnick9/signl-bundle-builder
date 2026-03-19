import AdminLayout from "@/components/admin-layout";
import {
  Page,
  Card,
  Text,
  BlockStack,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function AnalyticsPage() {
  return (
    <AdminLayout>
      <Page>
        <TitleBar title="Analytics" />
        <Card>
          <EmptyState
            heading="Analytics coming soon"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <BlockStack gap="200">
              <Text as="p" tone="subdued">
                Bundle view counts, add-to-cart rates, and order conversions will appear here once the analytics feature is live.
              </Text>
              <Text as="p" tone="subdued">
                In the meantime, you can track bundle performance through your Shopify Analytics dashboard.
              </Text>
            </BlockStack>
          </EmptyState>
        </Card>
      </Page>
    </AdminLayout>
  );
}
