import AdminLayout from "@/components/admin-layout";
import {
  Page,
  IndexTable,
  Badge,
  Text,
  EmptyState,
  Button,
  InlineStack,
  useIndexResourceState,
  Modal,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState, useCallback } from "react";
import type { Bundle } from "@shared/schema";

function statusBadge(status: string) {
  if (status === "active") return <Badge tone="success">Active</Badge>;
  if (status === "archived") return <Badge tone="warning">Archived</Badge>;
  return <Badge tone="info">Draft</Badge>;
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminBundles() {
  const [, navigate] = useLocation();
  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);

  const { data: bundles = [], isLoading } = useQuery<Bundle[]>({
    queryKey: ["/api/bundles"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/bundles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bundles"] });
      setDeleteTarget(null);
    },
  });

  const confirmDelete = useCallback((bundle: Bundle) => {
    setDeleteTarget(bundle);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  }, [deleteTarget, deleteMutation]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const resourceName = { singular: "bundle", plural: "bundles" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(bundles.map((b) => ({ id: String(b.id) })));

  const rowMarkup = bundles.map((bundle, index) => (
    <IndexTable.Row
      id={String(bundle.id)}
      key={bundle.id}
      selected={selectedResources.includes(String(bundle.id))}
      position={index}
      data-testid={`row-bundle-${bundle.id}`}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {bundle.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {statusBadge(bundle.status)}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {bundle.discountType === "percentage" ? "% off" : "$ off"} per tier
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {formatDate(bundle.createdAt)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button
            size="slim"
            onClick={() => navigate(`/admin/bundles/${bundle.id}`)}
            data-testid={`button-edit-bundle-${bundle.id}`}
          >
            Edit
          </Button>
          <Button
            size="slim"
            tone="critical"
            onClick={() => confirmDelete(bundle)}
            data-testid={`button-delete-bundle-${bundle.id}`}
          >
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <AdminLayout>
      <Page>
        <TitleBar title="Bundles">
          <button
            variant="primary"
            onClick={() => navigate("/admin/bundles/new")}
            data-testid="button-create-bundle"
          >
            Create bundle
          </button>
        </TitleBar>

        <Modal
          open={deleteTarget !== null}
          onClose={handleCancelDelete}
          title="Delete bundle?"
          primaryAction={{
            content: "Delete",
            destructive: true,
            loading: deleteMutation.isPending,
            onAction: handleConfirmDelete,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleCancelDelete,
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              Are you sure you want to delete{" "}
              <Text as="span" fontWeight="bold">
                {deleteTarget?.name}
              </Text>
              ? This will permanently remove the bundle and all its slot
              configuration. This action cannot be undone.
            </Text>
          </Modal.Section>
        </Modal>

        {!isLoading && bundles.length === 0 ? (
          <EmptyState
            heading="Create your first bundle"
            action={{
              content: "Create bundle",
              onAction: () => navigate("/admin/bundles/new"),
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Bundle your products together and offer volume discounts to
              increase average order value.
            </p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={resourceName}
            itemCount={bundles.length}
            selectedItemsCount={
              allResourcesSelected ? "All" : selectedResources.length
            }
            onSelectionChange={handleSelectionChange}
            loading={isLoading}
            headings={[
              { title: "Bundle name" },
              { title: "Status" },
              { title: "Discount type" },
              { title: "Created" },
              { title: "Actions" },
            ]}
          >
            {rowMarkup}
          </IndexTable>
        )}
      </Page>
    </AdminLayout>
  );
}
