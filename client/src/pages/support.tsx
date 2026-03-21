import AdminLayout from "@/components/admin-layout";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Divider,
  Box,
  Banner,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { EmailIcon, ExternalIcon, QuestionCircleIcon } from "@shopify/polaris-icons";

const FAQ_ITEMS = [
  {
    q: "How do I install the bundle picker on my storefront?",
    a: "After OAuth is complete, go to your Shopify Theme Editor → Add section → Apps → SiGNL Bundle Builder. The widget appears on any page or product page you choose.",
  },
  {
    q: "Why isn't the discount applying at checkout?",
    a: "Make sure the Discount Function is registered (visible on the Bundles page). You'll also need to deploy the Shopify Function using the Shopify CLI and set the SHOPIFY_FUNCTION_ID environment variable.",
  },
  {
    q: "Can I use the bundle builder without a Shopify subscription?",
    a: "The app requires an active SiGNL Bundle Builder subscription ($19.99/month after a 7-day free trial). Bundle configurations are saved and will resume if you resubscribe.",
  },
  {
    q: "How do I add products to a bundle slot?",
    a: "When creating or editing a bundle, click 'Browse Shopify products' inside a slot to open the Shopify product picker. This works when the app is open inside Shopify Admin. You can also type product titles and IDs manually.",
  },
  {
    q: "Can I preview how the bundle looks before publishing?",
    a: "Yes — click 'Preview Storefront UI' on the Bundles page. This opens a preview of the bundle widget as your customers will see it.",
  },
  {
    q: "How do I change the appearance of the bundle widget?",
    a: "Go to Settings → Theme Colors to customize button colors, border colors, fonts, sticky cart colors, and more. You can also inject custom CSS scoped to the widget.",
  },
];

export default function SupportPage() {
  return (
    <AdminLayout>
      <Page>
        <TitleBar title="Support" />
        <BlockStack gap="500">
          <Banner
            title="Need help getting started?"
            tone="info"
            action={{
              content: "Email support",
              url: "mailto:support@signlhub.com",
              external: true,
            }}
          >
            <Text as="p">
              Our support team typically responds within one business day. Include your shop URL and a description of your issue.
            </Text>
          </Banner>

          <Card>
            <BlockStack gap="500">
              <Text as="h2" variant="headingMd">Get in Touch</Text>
              <Divider />
              <InlineStack gap="400" wrap>
                <Box minWidth="200px">
                  <BlockStack gap="200">
                    <Text as="p" fontWeight="semibold">Email Support</Text>
                    <Text as="p" tone="subdued">For bugs, billing questions, and feature requests.</Text>
                    <Button
                      icon={EmailIcon}
                      url="mailto:support@signlhub.com"
                      external
                      data-testid="link-email-support"
                    >
                      support@signlhub.com
                    </Button>
                  </BlockStack>
                </Box>
                <Box minWidth="200px">
                  <BlockStack gap="200">
                    <Text as="p" fontWeight="semibold">Documentation</Text>
                    <Text as="p" tone="subdued">Setup guides, API references, and tutorials.</Text>
                    <Button
                      icon={ExternalIcon}
                      url="https://docs.signl.app"
                      external
                      data-testid="link-docs"
                    >
                      docs.signl.app
                    </Button>
                  </BlockStack>
                </Box>
                <Box minWidth="200px">
                  <BlockStack gap="200">
                    <Text as="p" fontWeight="semibold">Shopify App Listing</Text>
                    <Text as="p" tone="subdued">Leave a review or report an issue via the Shopify App Store.</Text>
                    <Button
                      icon={ExternalIcon}
                      url="https://apps.shopify.com/signl-bundle-builder"
                      external
                      data-testid="link-app-listing"
                    >
                      View on App Store
                    </Button>
                  </BlockStack>
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="500">
              <InlineStack gap="200" blockAlign="center">
                <QuestionCircleIcon width={20} height={20} />
                <Text as="h2" variant="headingMd">Frequently Asked Questions</Text>
              </InlineStack>
              <Divider />
              <BlockStack gap="400">
                {FAQ_ITEMS.map((item, i) => (
                  <BlockStack key={i} gap="100">
                    <Text as="p" fontWeight="semibold">{item.q}</Text>
                    <Text as="p" tone="subdued">{item.a}</Text>
                    {i < FAQ_ITEMS.length - 1 && <Divider />}
                  </BlockStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Useful Resources</Text>
              <Divider />
              <List type="bullet">
                <List.Item>
                  <Button variant="plain" url="https://shopify.dev/docs/apps/online-store/theme-app-extensions" external>
                    Shopify Theme App Extensions — developer docs
                  </Button>
                </List.Item>
                <List.Item>
                  <Button variant="plain" url="https://shopify.dev/docs/apps/functions" external>
                    Shopify Functions — how discounts work at checkout
                  </Button>
                </List.Item>
                <List.Item>
                  <Button variant="plain" url="https://shopify.dev/docs/apps/billing" external>
                    Shopify App Billing — managing your subscription
                  </Button>
                </List.Item>
              </List>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AdminLayout>
  );
}
