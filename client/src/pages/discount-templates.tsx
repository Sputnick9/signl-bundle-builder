import AdminLayout from "@/components/admin-layout";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Page, Card, Button, InlineStack, BlockStack, Text, TextField, Select, DataTable, Badge, Banner, Spinner, Modal, EmptyState, Divider, Box } from "@shopify/polaris";
import { PlusIcon, DeleteIcon, EditIcon } from "@shopify/polaris-icons";

interface DiscountTierRule {
  minQty: number;
  discountValue: number;
}

interface DiscountTemplate {
  id: number;
  shop: string;
  name: string;
  key: string;
  discountType: string;
  tiers: DiscountTierRule[];
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  name: "",
  key: "",
  discountType: "percentage" as "percentage" | "fixed",
  tiers: [{ minQty: 2, discountValue: 10 }] as DiscountTierRule[],
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function DiscountTemplatesPage() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [keyEdited, setKeyEdited] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: templates = [], isLoading } = useQuery<DiscountTemplate[]>({
    queryKey: ["/api/discount-templates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => apiRequest("POST", "/api/discount-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discount-templates"] });
      closeModal();
      toast({ title: "Discount template created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof EMPTY_FORM }) =>
      apiRequest("PATCH", `/api/discount-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discount-templates"] });
      closeModal();
      toast({ title: "Discount template updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/discount-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discount-templates"] });
      setDeleteId(null);
      toast({ title: "Discount template deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setKeyEdited(false);
    setFormErrors({});
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(t: DiscountTemplate) {
    setForm({
      name: t.name,
      key: t.key,
      discountType: t.discountType as "percentage" | "fixed",
      tiers: t.tiers.length ? t.tiers : [{ minQty: 2, discountValue: 10 }],
    });
    setKeyEdited(true);
    setFormErrors({});
    setEditingId(t.id);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormErrors({});
  }

  function setNameValue(v: string) {
    setForm((f) => ({ ...f, name: v, key: keyEdited ? f.key : slugify(v) }));
  }

  function setKeyValue(v: string) {
    setKeyEdited(true);
    setForm((f) => ({ ...f, key: v.toLowerCase().replace(/[^a-z0-9_-]/g, "") }));
  }

  const MAX_TIERS = 4;

  function addTier() {
    setForm((f) => {
      if (f.tiers.length >= MAX_TIERS) return f;
      return { ...f, tiers: [...f.tiers, { minQty: (f.tiers.at(-1)?.minQty ?? 1) + 1, discountValue: 0 }] };
    });
  }

  function removeTier(i: number) {
    setForm((f) => ({ ...f, tiers: f.tiers.filter((_, idx) => idx !== i) }));
  }

  function updateTier(i: number, field: keyof DiscountTierRule, value: number) {
    setForm((f) => ({
      ...f,
      tiers: f.tiers.map((t, idx) => idx === i ? { ...t, [field]: value } : t),
    }));
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Name is required";
    if (!form.key.trim()) errors.key = "Key is required";
    else if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(form.key)) {
      errors.key = "Key must be lowercase alphanumeric with hyphens/underscores only";
    }
    if (!form.tiers.length) errors.tiers = "At least one tier is required";
    form.tiers.forEach((t, i) => {
      if (t.minQty < 1) errors[`tier_${i}_minQty`] = "Min qty must be ≥ 1";
      if (t.discountValue < 0) errors[`tier_${i}_discountValue`] = "Value must be ≥ 0";
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const rows = templates.map((t) => [
    <Text as="span" variant="bodyMd" fontWeight="semibold">{t.name}</Text>,
    <Text as="span" variant="bodySm" tone="subdued"><code>{t.key}</code></Text>,
    <Badge tone={t.discountType === "percentage" ? "info" : "success"}>
      {t.discountType === "percentage" ? "Percentage" : "Fixed"}
    </Badge>,
    <Text as="span" variant="bodySm">
      {t.tiers.map((tier) =>
        t.discountType === "percentage"
          ? `${tier.minQty}+ items → ${tier.discountValue}% off`
          : `${tier.minQty}+ items → $${(tier.discountValue / 100).toFixed(2)} off`
      ).join(", ")}
    </Text>,
    <InlineStack gap="200">
      <Button icon={EditIcon} size="slim" onClick={() => openEdit(t)} data-testid={`btn-edit-template-${t.id}`}>Edit</Button>
      <Button icon={DeleteIcon} size="slim" tone="critical" onClick={() => setDeleteId(t.id)} data-testid={`btn-delete-template-${t.id}`}>Delete</Button>
    </InlineStack>,
  ]);

  const unitLabel = form.discountType === "percentage" ? "%" : "¢ (cents)";

  return (
    <AdminLayout>
      <Page
        title="Discount Templates"
        primaryAction={{
          content: "Create Template",
          icon: PlusIcon,
          onAction: openCreate,
        }}
        subtitle="Named discount tiers referenced by Bundle Builder theme sections. Use the key slug in your theme editor."
      >
        <BlockStack gap="500">
          <Banner tone="info">
            <p>
              Create a discount template, then enter its <strong>Key</strong> in the "Discount Template Key" field of your Bundle Builder theme section. The Shopify Function applies the discount at checkout automatically.
            </p>
          </Banner>

          <Card>
            {isLoading ? (
              <Box padding="800">
                <InlineStack align="center"><Spinner /></InlineStack>
              </Box>
            ) : templates.length === 0 ? (
              <EmptyState
                heading="No discount templates yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={{ content: "Create Template", onAction: openCreate }}
              >
                <p>Create reusable discount templates for your Bundle Builder theme sections.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text"]}
                headings={["Name", "Key", "Type", "Tiers", "Actions"]}
                rows={rows}
              />
            )}
          </Card>
        </BlockStack>

        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={editingId ? "Edit Discount Template" : "Create Discount Template"}
          primaryAction={{ content: isSaving ? "Saving…" : "Save Template", onAction: handleSubmit, loading: isSaving }}
          secondaryActions={[{ content: "Cancel", onAction: closeModal }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                label="Template Name"
                value={form.name}
                onChange={setNameValue}
                error={formErrors.name}
                autoComplete="off"
                data-testid="input-template-name"
                helpText="Descriptive label shown in the admin only"
              />
              <TextField
                label="Key (slug)"
                value={form.key}
                onChange={setKeyValue}
                error={formErrors.key}
                autoComplete="off"
                data-testid="input-template-key"
                helpText="Unique per store — used in your theme editor's Discount Template Key field. E.g. summer-bundle"
              />
              <Select
                label="Discount Type"
                options={[
                  { label: "Percentage (e.g. 10% off)", value: "percentage" },
                  { label: "Fixed amount (enter value in cents, e.g. 500 = $5.00)", value: "fixed" },
                ]}
                value={form.discountType}
                onChange={(v) => setForm((f) => ({ ...f, discountType: v as "percentage" | "fixed" }))}
                data-testid="select-discount-type"
              />

              <Divider />

              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingSm">Discount Tiers</Text>
                  <Button size="slim" onClick={addTier} disabled={form.tiers.length >= MAX_TIERS} data-testid="btn-add-tier">
                    {form.tiers.length >= MAX_TIERS ? `Max ${MAX_TIERS} tiers` : "Add Tier"}
                  </Button>
                </InlineStack>
                {formErrors.tiers && <Text as="p" tone="critical">{formErrors.tiers}</Text>}
                {form.tiers.map((tier, i) => (
                  <Card key={i}>
                    <InlineStack gap="300" blockAlign="end">
                      <Box minWidth="120px">
                        <TextField
                          label="Min Items"
                          type="number"
                          value={String(tier.minQty)}
                          onChange={(v) => updateTier(i, "minQty", parseInt(v, 10) || 1)}
                          error={formErrors[`tier_${i}_minQty`]}
                          autoComplete="off"
                          data-testid={`input-tier-${i}-minqty`}
                        />
                      </Box>
                      <Box minWidth="150px">
                        <TextField
                          label={`Discount Value (${unitLabel})`}
                          type="number"
                          value={String(tier.discountValue)}
                          onChange={(v) => updateTier(i, "discountValue", parseFloat(v) || 0)}
                          error={formErrors[`tier_${i}_discountValue`]}
                          autoComplete="off"
                          data-testid={`input-tier-${i}-value`}
                        />
                      </Box>
                      <Button
                        icon={DeleteIcon}
                        size="slim"
                        tone="critical"
                        onClick={() => removeTier(i)}
                        disabled={form.tiers.length <= 1}
                        data-testid={`btn-remove-tier-${i}`}
                      />
                    </InlineStack>
                  </Card>
                ))}
              </BlockStack>
            </BlockStack>
          </Modal.Section>
        </Modal>

        <Modal
          open={deleteId !== null}
          onClose={() => setDeleteId(null)}
          title="Delete Discount Template"
          primaryAction={{
            content: deleteMutation.isPending ? "Deleting…" : "Delete",
            onAction: () => deleteId !== null && deleteMutation.mutate(deleteId),
            loading: deleteMutation.isPending,
            destructive: true,
          }}
          secondaryActions={[{ content: "Cancel", onAction: () => setDeleteId(null) }]}
        >
          <Modal.Section>
            <Text as="p">This will permanently delete the discount template. Theme sections referencing its key will stop applying discounts.</Text>
          </Modal.Section>
        </Modal>
      </Page>
    </AdminLayout>
  );
}
