import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin-layout";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Divider,
  Banner,
  FormLayout,
  TextField,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_SHOP_SETTINGS } from "@shared/schema";

type SettingsData = {
  buttonPrimary: string;
  buttonSecondary: string;
  themeAccent: string;
  borderColor: string;
  fontColor: string;
  stickyCartBg: string;
  stickyCartText: string;
  progressBarFill: string;
  progressBarBg: string;
  customCss: string;
};

function ColorField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`color-swatch-${testId}`}
          style={{
            width: "40px",
            height: "40px",
            padding: "2px",
            border: "1px solid #D1D5DB",
            borderRadius: "6px",
            cursor: "pointer",
            background: "none",
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <TextField
          label={label}
          value={value}
          onChange={(v) => {
            if (/^#([0-9A-Fa-f]{0,6})$/.test(v) || v === "") {
              onChange(v.startsWith("#") ? v : "#" + v);
            }
          }}
          autoComplete="off"
          data-testid={`input-color-${testId}`}
          connectedLeft={null}
        />
      </div>
    </div>
  );
}

function ColorSection({
  title,
  description,
  fields,
  values,
  onChange,
}: {
  title: string;
  description: string;
  fields: Array<{ key: keyof SettingsData; label: string }>;
  values: SettingsData;
  onChange: (key: keyof SettingsData, value: string) => void;
}) {
  return (
    <BlockStack gap="300">
      <BlockStack gap="100">
        <Text as="h3" variant="headingSm">
          {title}
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          {description}
        </Text>
      </BlockStack>
      <FormLayout>
        {fields.map((f) => (
          <ColorField
            key={f.key}
            label={f.label}
            value={values[f.key] as string}
            onChange={(v) => onChange(f.key, v)}
            testId={f.key}
          />
        ))}
      </FormLayout>
    </BlockStack>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: savedSettings, isLoading } = useQuery<SettingsData>({
    queryKey: ["/api/settings"],
  });

  const [form, setForm] = useState<SettingsData>({
    ...DEFAULT_SHOP_SETTINGS,
  });

  useEffect(() => {
    if (savedSettings) {
      setForm({
        buttonPrimary: savedSettings.buttonPrimary ?? DEFAULT_SHOP_SETTINGS.buttonPrimary,
        buttonSecondary: savedSettings.buttonSecondary ?? DEFAULT_SHOP_SETTINGS.buttonSecondary,
        themeAccent: savedSettings.themeAccent ?? DEFAULT_SHOP_SETTINGS.themeAccent,
        borderColor: savedSettings.borderColor ?? DEFAULT_SHOP_SETTINGS.borderColor,
        fontColor: savedSettings.fontColor ?? DEFAULT_SHOP_SETTINGS.fontColor,
        stickyCartBg: savedSettings.stickyCartBg ?? DEFAULT_SHOP_SETTINGS.stickyCartBg,
        stickyCartText: savedSettings.stickyCartText ?? DEFAULT_SHOP_SETTINGS.stickyCartText,
        progressBarFill: savedSettings.progressBarFill ?? DEFAULT_SHOP_SETTINGS.progressBarFill,
        progressBarBg: savedSettings.progressBarBg ?? DEFAULT_SHOP_SETTINGS.progressBarBg,
        customCss: savedSettings.customCss ?? DEFAULT_SHOP_SETTINGS.customCss,
      });
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: (data: SettingsData) =>
      apiRequest("PUT", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved", description: "Your theme settings have been saved." });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save settings. Please try again.", variant: "destructive" });
    },
  });

  function handleChange(key: keyof SettingsData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleResetColors() {
    setForm((prev) => ({
      ...prev,
      buttonPrimary: DEFAULT_SHOP_SETTINGS.buttonPrimary,
      buttonSecondary: DEFAULT_SHOP_SETTINGS.buttonSecondary,
      themeAccent: DEFAULT_SHOP_SETTINGS.themeAccent,
      borderColor: DEFAULT_SHOP_SETTINGS.borderColor,
      fontColor: DEFAULT_SHOP_SETTINGS.fontColor,
      stickyCartBg: DEFAULT_SHOP_SETTINGS.stickyCartBg,
      stickyCartText: DEFAULT_SHOP_SETTINGS.stickyCartText,
      progressBarFill: DEFAULT_SHOP_SETTINGS.progressBarFill,
      progressBarBg: DEFAULT_SHOP_SETTINGS.progressBarBg,
    }));
  }

  function handleResetCss() {
    setForm((prev) => ({ ...prev, customCss: DEFAULT_SHOP_SETTINGS.customCss }));
  }

  function handleSave() {
    saveMutation.mutate(form);
  }

  return (
    <AdminLayout>
      <Page>
        <TitleBar title="Settings" />
        <BlockStack gap="500">
          {/* Theme Colors Card */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Theme Colors
                  </Text>
                  <Text as="p" tone="subdued">
                    Customize the colors of your bundle builder widget. Changes apply to all bundles on your storefront.
                  </Text>
                </BlockStack>
                <Button
                  onClick={handleResetColors}
                  variant="plain"
                  data-testid="button-reset-colors"
                >
                  Reset to defaults
                </Button>
              </InlineStack>

              <Divider />

              <ColorSection
                title="Button & CTA"
                description="Colors for primary action buttons and secondary interactive elements."
                fields={[
                  { key: "buttonPrimary", label: "Primary button color" },
                  { key: "buttonSecondary", label: "Secondary button / text color" },
                  { key: "themeAccent", label: "Theme accent color" },
                ]}
                values={form}
                onChange={handleChange}
              />

              <Divider />

              <ColorSection
                title="Layout & Borders"
                description="Border and font colors that define the widget's structure and typography."
                fields={[
                  { key: "borderColor", label: "Border color" },
                  { key: "fontColor", label: "Font color" },
                ]}
                values={form}
                onChange={handleChange}
              />

              <Divider />

              <ColorSection
                title="Progress Bar"
                description="Colors for the discount progress bar shown inside the widget."
                fields={[
                  { key: "progressBarFill", label: "Progress bar fill color" },
                  { key: "progressBarBg", label: "Progress bar background color" },
                ]}
                values={form}
                onChange={handleChange}
              />

              <Divider />

              <ColorSection
                title="Sticky Cart"
                description="Colors for the sticky add-to-cart bar at the bottom of the widget."
                fields={[
                  { key: "stickyCartBg", label: "Sticky cart background" },
                  { key: "stickyCartText", label: "Sticky cart text color" },
                ]}
                values={form}
                onChange={handleChange}
              />

              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saveMutation.isPending}
                  disabled={isLoading}
                  data-testid="button-save-colors"
                >
                  Save colors
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Custom CSS Card */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Custom CSS
                  </Text>
                  <Text as="p" tone="subdued">
                    Write custom CSS that will be injected directly into the bundle builder widget.
                  </Text>
                </BlockStack>
                <Button
                  onClick={handleResetCss}
                  variant="plain"
                  data-testid="button-reset-css"
                >
                  Clear CSS
                </Button>
              </InlineStack>

              <Banner tone="info">
                <p>
                  This CSS is scoped to the bundle builder widget only — it will not affect the rest of your storefront. Use <code>.signl-bp</code> as the root selector, for example: <code>.signl-bp .signl-bp__add-btn {"{"} border-radius: 0; {"}"}</code>
                </p>
              </Banner>

              <TextField
                label="Custom CSS"
                labelHidden
                value={form.customCss}
                onChange={(v) => handleChange("customCss", v)}
                multiline={12}
                autoComplete="off"
                monospaced
                placeholder={`.signl-bp {\n  /* your custom styles here */\n}`}
                data-testid="input-custom-css"
              />

              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saveMutation.isPending}
                  disabled={isLoading}
                  data-testid="button-save-css"
                >
                  Save CSS
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AdminLayout>
  );
}
