"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/ui/StatusBadge";

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  address?: { city?: string; region?: string; province?: string; country?: string };
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  client: "Client",
  technician: "Technicien",
  admin: "Admin",
  super_admin: "Super Admin",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [message, setMessage] = useState("");
  const [editRole, setEditRole] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.listUsers({
          limit: 50,
          search: search || undefined,
          role: roleFilter || undefined,
        }),
        api.userStats(),
      ]);
      if (listRes.success && listRes.data) setUsers(listRes.data as UserRow[]);
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data as Record<string, number>);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, roleFilter]);

  const handleUpdateRole = async () => {
    if (!selected || !editRole) return;
    setMessage("");
    const res = await api.adminUpdateUser(selected.id, { role: editRole });
    if (res.success) {
      setMessage("Role mis a jour");
      load();
      if (res.data) setSelected(res.data as UserRow);
    } else {
      setMessage(res.error || "Erreur");
    }
  };

  const handleToggleActive = async () => {
    if (!selected) return;
    setMessage("");
    if (selected.is_active) {
      const res = await api.deactivateUser(selected.id);
      if (res.success) {
        setMessage("Utilisateur desactive");
        load();
        setSelected({ ...selected, is_active: false });
      } else {
        setMessage(res.error || "Erreur");
      }
    } else {
      const res = await api.adminUpdateUser(selected.id, { is_active: true });
      if (res.success) {
        setMessage("Utilisateur reactive");
        load();
        setSelected({ ...selected, is_active: true });
      } else {
        setMessage(res.error || "Erreur");
      }
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Utilisateurs</h1>
      <p className="mt-1 text-slate-600">Gestion des comptes et roles (RBAC)</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total", key: "total" },
          { label: "Clients", key: "client" },
          { label: "Techniciens", key: "technician" },
          { label: "Admins", key: "admin" },
        ].map((k) => (
          <div key={k.key} className="card p-4">
            <p className="text-xs font-medium uppercase text-slate-400">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {stats[k.key] ?? "—"}
            </p>
          </div>
        ))}
      </div>

      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-800">
          {message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Rechercher email, nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">Tous les roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-3">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Localisation</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Chargement...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Aucun utilisateur
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => {
                      setSelected(u);
                      setEditRole(u.role);
                    }}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      selected?.id === u.id ? "bg-primary-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {u.first_name} {u.last_name}
                      </p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">{ROLE_LABELS[u.role] || u.role}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {u.address?.city || u.address?.region || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={u.is_active ? "delivered" : "cancelled"}
                        label={u.is_active ? "Actif" : "Inactif"}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card p-5 lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-900">
                {selected.first_name} {selected.last_name}
              </h2>
              <p className="text-sm text-slate-500">{selected.email}</p>
              {selected.phone && (
                <p className="text-sm text-slate-600">{selected.phone}</p>
              )}
              {selected.address && (
                <p className="text-sm text-slate-600">
                  {[selected.address.city, selected.address.region, selected.address.province]
                    .filter(Boolean)
                    .join(", ")}
                  {selected.address.country ? ` — ${selected.address.country}` : ""}
                </p>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-400">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="input-field"
                >
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button onClick={handleUpdateRole} className="btn-primary mt-2 w-full text-sm">
                  Mettre a jour le role
                </button>
              </div>
              <button
                onClick={handleToggleActive}
                className={`btn-secondary w-full text-sm ${
                  selected.is_active ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {selected.is_active ? "Desactiver le compte" : "Reactiver le compte"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Selectionnez un utilisateur</p>
          )}
        </div>
      </div>
    </div>
  );
}
