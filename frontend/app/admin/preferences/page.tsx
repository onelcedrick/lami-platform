"use client";

import { useState } from "react";
import { useSettingsStore } from "@/lib/settings-store";
import SettingsSection from "@/components/admin/settings/SettingsSection";
import SettingsItem from "@/components/admin/settings/SettingsItem";
import ToggleSwitch from "@/components/admin/settings/ToggleSwitch";
import RadioGroup from "@/components/admin/settings/RadioGroup";
import LogoUploader from "@/components/admin/settings/LogoUploader";
import {
  CpuIcon,
  CartIcon,
  BellIcon,
  RefreshIcon,
  CheckIcon,
  FolderIcon,
} from "@/components/ui/icons";

export default function AdminPreferencesPage() {
  const {
    logoIcon,
    logoCompact,
    logoFull,
    setLogoIcon,
    setLogoCompact,
    setLogoFull,
    resetLogos,
    productFormMode,
    skuAutoGenerate,
    imageCompression,
    maxProductImages,
    productsPerPage,
    defaultSort,
    notifyNewOrder,
    notifyNewTicket,
    notifyLowStock,
    setProductFormMode,
    setSkuAutoGenerate,
    setImageCompression,
    setMaxProductImages,
    setProductsPerPage,
    setDefaultSort,
    setNotifyNewOrder,
    setNotifyNewTicket,
    setNotifyLowStock,
    resetAll,
  } = useSettingsStore();

  const [saved, setSaved] = useState(false);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (
      window.confirm(
        "Reinitialiser tous les parametres aux valeurs par defaut ?"
      )
    ) {
      resetAll();
      flash();
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--fg-primary)]">
          Preferences
        </h1>
        <p className="mt-1 text-[var(--fg-secondary)]">
          Personnalisez votre experience d&apos;administration
        </p>
      </div>

      {/* Message sauvegarde */}
      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckIcon size={16} />
          Preferences enregistrees
        </div>
      )}

      <div className="space-y-6">
        {/* ============================================= */}
        {/* LOGO & BRANDING                               */}
        {/* ============================================= */}
        <SettingsSection
          title="Logo & Branding"
          description="Personnalisez le logo affiche sur la plateforme"
          icon={<FolderIcon size={20} />}
        >
          <LogoUploader
            label="Logo icone (sidebar)"
            description="Affiche dans le coin superieur de la sidebar admin - Format carre"
            value={logoIcon}
            onChange={(v) => {
              setLogoIcon(v);
              flash();
            }}
            variant="icon"
          />

          <LogoUploader
            label="Logo compact (header)"
            description="Affiche dans le header du site - Format horizontal"
            value={logoCompact}
            onChange={(v) => {
              setLogoCompact(v);
              flash();
            }}
            variant="compact"
          />

          <LogoUploader
            label="Logo complet (login & register)"
            description="Affiche sur les pages de connexion - Format large"
            value={logoFull}
            onChange={(v) => {
              setLogoFull(v);
              flash();
            }}
            variant="full"
          />

          {(logoIcon || logoCompact || logoFull) && (
            <SettingsItem
              label="Reinitialiser les logos"
              description="Restaure les logos par defaut L'AMI"
            >
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Supprimer tous les logos custom ?")) {
                    resetLogos();
                    flash();
                  }
                }}
                className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                Reinitialiser
              </button>
            </SettingsItem>
          )}
        </SettingsSection>

        {/* ============================================= */}
        {/* LOGO & BRANDING                               */}
        {/* ============================================= */}
        <SettingsSection
          title="Logo & Branding"
          description="Personnalisez le logo affiche sur la plateforme"
          icon={<FolderIcon size={20} />}
        >
          <LogoUploader
            label="Logo icone (sidebar)"
            description="Affiche dans le coin superieur de la sidebar admin - Format carre"
            value={logoIcon}
            onChange={(v) => {
              setLogoIcon(v);
              flash();
            }}
            variant="icon"
          />

          <LogoUploader
            label="Logo compact (header)"
            description="Affiche dans le header du site - Format horizontal"
            value={logoCompact}
            onChange={(v) => {
              setLogoCompact(v);
              flash();
            }}
            variant="compact"
          />

          <LogoUploader
            label="Logo complet (login & register)"
            description="Affiche sur les pages de connexion - Format large"
            value={logoFull}
            onChange={(v) => {
              setLogoFull(v);
              flash();
            }}
            variant="full"
          />

          {(logoIcon || logoCompact || logoFull) && (
            <SettingsItem
              label="Reinitialiser les logos"
              description="Restaure les logos par defaut L'AMI"
            >
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Supprimer tous les logos custom ?")) {
                    resetLogos();
                    flash();
                  }
                }}
                className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                Reinitialiser
              </button>
            </SettingsItem>
          )}
        </SettingsSection>

        {/* ============================================= */}
        {/* FORMULAIRE PRODUIT                            */}
        {/* ============================================= */}
        <SettingsSection
          title="Formulaire produit"
          description="Comment creer et modifier vos produits"
          icon={<CpuIcon size={20} />}
        >
          <SettingsItem
            label="Mode de creation"
            description="Choisissez comment creer un nouveau produit"
            align="below"
          >
            <RadioGroup
              name="productFormMode"
              value={productFormMode}
              onChange={(v) => {
                setProductFormMode(v);
                flash();
              }}
              options={[
                {
                  value: "wizard",
                  label: "Wizard (recommande)",
                  description:
                    "Formulaire en 2 etapes : informations de base puis details",
                },
                {
                  value: "classic",
                  label: "Classique",
                  description:
                    "Formulaire unique dans une fenetre modale (ancienne methode)",
                },
              ]}
            />
          </SettingsItem>

          <SettingsItem
            label="SKU auto-generation"
            description="Proposer un SKU base sur categorie + marque + modele"
          >
            <ToggleSwitch
              checked={skuAutoGenerate}
              onChange={(v) => {
                setSkuAutoGenerate(v);
                flash();
              }}
            />
          </SettingsItem>

          <SettingsItem
            label="Compression des images"
            description="Reduire automatiquement le poids des images uploadees"
          >
            <select
              className="input-field w-auto"
              value={imageCompression}
              onChange={(e) => {
                setImageCompression(
                  e.target.value as typeof imageCompression
                );
                flash();
              }}
            >
              <option value="none">Aucune</option>
              <option value="low">Faible</option>
              <option value="medium">Moyenne (recommande)</option>
              <option value="high">Elevee</option>
            </select>
          </SettingsItem>

          <SettingsItem
            label="Nombre max d'images par produit"
            description="Entre 1 et 20"
          >
            <input
              type="number"
              min={1}
              max={20}
              className="input-field w-24 text-center"
              value={maxProductImages}
              onChange={(e) => {
                const v = Math.max(1, Math.min(20, Number(e.target.value) || 8));
                setMaxProductImages(v);
                flash();
              }}
            />
          </SettingsItem>
        </SettingsSection>

        {/* ============================================= */}
        {/* CATALOGUE                                     */}
        {/* ============================================= */}
        <SettingsSection
          title="Catalogue"
          description="Affichage des produits cote client"
          icon={<CartIcon size={20} />}
        >
          <SettingsItem
            label="Produits par page"
            description="Nombre de produits affiches dans le catalogue"
          >
            <select
              className="input-field w-auto"
              value={productsPerPage}
              onChange={(e) => {
                setProductsPerPage(
                  Number(e.target.value) as typeof productsPerPage
                );
                flash();
              }}
            >
              <option value={12}>12</option>
              <option value={24}>24 (recommande)</option>
              <option value={48}>48</option>
            </select>
          </SettingsItem>

          <SettingsItem
            label="Tri par defaut"
            description="Ordre d'affichage initial du catalogue"
          >
            <select
              className="input-field w-auto"
              value={defaultSort}
              onChange={(e) => {
                setDefaultSort(e.target.value as typeof defaultSort);
                flash();
              }}
            >
              <option value="relevance">Pertinence</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix decroissant</option>
              <option value="name">Nom (A-Z)</option>
            </select>
          </SettingsItem>
        </SettingsSection>

        {/* ============================================= */}
        {/* NOTIFICATIONS                                 */}
        {/* ============================================= */}
        <SettingsSection
          title="Notifications"
          description="Alertes affichees dans l'interface admin"
          icon={<BellIcon size={20} />}
        >
          <SettingsItem
            label="Nouvelle commande"
            description="Notification a chaque nouvelle commande"
          >
            <ToggleSwitch
              checked={notifyNewOrder}
              onChange={(v) => {
                setNotifyNewOrder(v);
                flash();
              }}
            />
          </SettingsItem>

          <SettingsItem
            label="Nouveau ticket support"
            description="Notification a chaque ticket cree"
          >
            <ToggleSwitch
              checked={notifyNewTicket}
              onChange={(v) => {
                setNotifyNewTicket(v);
                flash();
              }}
            />
          </SettingsItem>

          <SettingsItem
            label="Stock bas"
            description="Alertes quand un produit atteint son seuil"
          >
            <ToggleSwitch
              checked={notifyLowStock}
              onChange={(v) => {
                setNotifyLowStock(v);
                flash();
              }}
            />
          </SettingsItem>
        </SettingsSection>

        {/* ============================================= */}
        {/* AVANCE                                        */}
        {/* ============================================= */}
        <SettingsSection
          title="Avance"
          description="Actions irreversibles"
          icon={<RefreshIcon size={20} />}
        >
          <SettingsItem
            label="Reinitialiser les preferences"
            description="Restaurer tous les parametres aux valeurs par defaut"
          >
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Reinitialiser
            </button>
          </SettingsItem>
        </SettingsSection>
      </div>
    </div>
  );
}
