import AdminLayout from "@/components/admin-layout";
import { Page, Card, BlockStack, Text, InlineStack, Divider, Box, List, Button, Banner } from "@shopify/polaris";

const STEPS = [
  {
    num: 1,
    title: "Install the SiGNL Bundle Builder Theme App Extension",
    content: (
      <BlockStack gap="200">
        <Text as="p">In your Shopify Admin, go to <strong>Online Store → Themes → Customize</strong>.</Text>
        <Text as="p">Click <strong>Add section</strong> on any page and search for <strong>"Bundle Builder"</strong> under <em>Apps</em>.</Text>
      </BlockStack>
    ),
  },
  {
    num: 2,
    title: "Add a Bundle Builder section to your theme",
    content: (
      <BlockStack gap="200">
        <Text as="p">Add the <strong>Bundle Builder</strong> section to a product page, collection page, or any custom page.</Text>
        <List type="bullet">
          <List.Item>Set the <strong>App URL</strong> to your deployed SiGNL app URL (e.g. <code>https://your-app.onrender.com</code>).</List.Item>
          <List.Item>Set a <strong>Heading</strong> and optional <strong>Subheading</strong>.</List.Item>
          <List.Item>Optionally set a <strong>Discount Template Key</strong> (see step 4).</List.Item>
        </List>
      </BlockStack>
    ),
  },
  {
    num: 3,
    title: "Add Category blocks",
    content: (
      <BlockStack gap="200">
        <Text as="p">Inside the Bundle Builder section, click <strong>Add block → Category</strong>.</Text>
        <List type="bullet">
          <List.Item>Give the category a <strong>Name</strong> (e.g. "Choose a Protein").</List.Item>
          <List.Item>Select the <strong>Collection</strong> whose products shoppers choose from.</List.Item>
          <List.Item>Set <strong>Min Items</strong> (minimum required selection) and <strong>Max Items</strong> (0 = unlimited).</List.Item>
        </List>
        <Text as="p">Add as many category blocks as needed — each becomes a tab in the bundle builder UI.</Text>
      </BlockStack>
    ),
  },
  {
    num: 4,
    title: "Create a Discount Template (optional)",
    content: (
      <BlockStack gap="200">
        <Text as="p">Go to <strong>Discount Templates</strong> in the left navigation.</Text>
        <List type="bullet">
          <List.Item>Create a template with a unique <strong>Key</strong> (e.g. <code>summer-bundle</code>).</List.Item>
          <List.Item>Add tiers: e.g. "Buy 3+ items → 10% off", "Buy 5+ items → 15% off".</List.Item>
        </List>
        <Text as="p">Back in your theme, paste the template <strong>Key</strong> into the <em>Discount Template Key</em> field of your Bundle Builder section.</Text>
        <Text as="p">The Shopify Function applies the discount at checkout automatically — no coupon codes needed.</Text>
      </BlockStack>
    ),
  },
  {
    num: 5,
    title: "Activate the Shopify Function",
    content: (
      <BlockStack gap="200">
        <Text as="p">In Shopify Admin, go to <strong>Discounts → Create discount → Product discount</strong>.</Text>
        <Text as="p">Select <strong>SiGNL Bundle Discount</strong> from the list of apps. Activate it with no minimum requirements and set it to <strong>Apply to all products</strong>.</Text>
        <Text as="p">The function reads discount tiers from cart line properties and applies the right tier at checkout.</Text>
      </BlockStack>
    ),
  },
  {
    num: 6,
    title: "Test your bundle",
    content: (
      <BlockStack gap="200">
        <Text as="p">Visit the page where you added the Bundle Builder section in your live store.</Text>
        <List type="bullet">
          <List.Item>Products should load from each collection within a few seconds.</List.Item>
          <List.Item>Select items from each category, then click <strong>Add Bundle to Cart</strong>.</List.Item>
          <List.Item>Proceed to checkout — the discount should appear automatically if tiers are configured.</List.Item>
        </List>
      </BlockStack>
    ),
  },
];

function getThemeEditorUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop") || "";
  if (!shop) return "https://admin.shopify.com/store/themes/current/editor";
  const storeName = shop.replace(".myshopify.com", "");
  return `https://admin.shopify.com/store/${storeName}/themes/current/editor`;
}

export default function SetupGuidePage() {
  return (
    <AdminLayout>
      <Page
        title="Setup Guide"
        subtitle="Get the Bundle Builder section running in your Shopify theme in minutes"
        primaryAction={{
          content: "Open Theme Editor",
          url: getThemeEditorUrl(),
          external: true,
        }}
      >
        <BlockStack gap="500">
          <Banner tone="success">
            <p>
              This is a <strong>theme-editor-native</strong> bundle builder — no liquid code editing required. Everything is configured directly in the Shopify theme editor using native section and block settings.
            </p>
          </Banner>

          {STEPS.map((step) => (
            <Card key={step.num}>
              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="center">
                  <Box
                    background="bg-fill-brand"
                    borderRadius="full"
                    minWidth="2rem"
                    minHeight="2rem"
                    padding="100"
                  >
                    <InlineStack align="center" blockAlign="center">
                      <Text as="span" variant="bodyMd" fontWeight="bold" tone="text-inverse">{step.num}</Text>
                    </InlineStack>
                  </Box>
                  <Text as="h2" variant="headingMd">{step.title}</Text>
                </InlineStack>
                <Divider />
                {step.content}
              </BlockStack>
            </Card>
          ))}

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Ready to go?</Text>
              <Text as="p">Open the Shopify theme editor to add the Bundle Builder section, or manage your discount templates.</Text>
              <InlineStack gap="300">
                <Button variant="primary" url={getThemeEditorUrl()} external>Open Theme Editor</Button>
                <Button url="/discount-templates">Manage Discount Templates</Button>
                <Button url="/support">Support</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AdminLayout>
  );
}
