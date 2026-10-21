
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "affaire": {
                  Row: {
                    "archive_le": string | null,"avis_google_obtenu_le": string | null,"client_id": string,"concepteur_id": string,"contremarque": string,"created_at": string,"created_by": string | null,"derniere_activite_at": string,"etape_courante_code": string | null,"id": string,"libelle": string,"libelle_manuel": boolean,"magasin_id": string,"montant_devis_ht_cts": number | null,"motif_perte": string | null,"pcloud_folder_id": string | null,"pcloud_url": string | null,"process_version_id": string,"projet": string,"statut": string,"updated_at": string,"vente_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archive_le"?: string | null,"avis_google_obtenu_le"?: string | null,"client_id": string,"concepteur_id": string,"contremarque": string,"created_at"?: string,"created_by"?: string | null,"derniere_activite_at": string,"etape_courante_code"?: string | null,"id"?: string,"libelle": string,"libelle_manuel"?: boolean,"magasin_id": string,"montant_devis_ht_cts"?: number | null,"motif_perte"?: string | null,"pcloud_folder_id"?: string | null,"pcloud_url"?: string | null,"process_version_id": string,"projet": string,"statut"?: string,"updated_at"?: string,"vente_id"?: string | null
                  }
                  Update: {
                    "archive_le"?: string | null,"avis_google_obtenu_le"?: string | null,"client_id"?: string,"concepteur_id"?: string,"contremarque"?: string,"created_at"?: string,"created_by"?: string | null,"derniere_activite_at"?: string,"etape_courante_code"?: string | null,"id"?: string,"libelle"?: string,"libelle_manuel"?: boolean,"magasin_id"?: string,"montant_devis_ht_cts"?: number | null,"motif_perte"?: string | null,"pcloud_folder_id"?: string | null,"pcloud_url"?: string | null,"process_version_id"?: string,"projet"?: string,"statut"?: string,"updated_at"?: string,"vente_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "affaire_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affaire_concepteur_id_fkey"
      columns: ["concepteur_id"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affaire_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affaire_magasin_id_fkey"
      columns: ["magasin_id"]
isOneToOne: false
      referencedRelation: "magasin"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affaire_process_version_id_fkey"
      columns: ["process_version_id"]
isOneToOne: false
      referencedRelation: "process_version"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affaire_vente_id_fkey"
      columns: ["vente_id"]
isOneToOne: false
      referencedRelation: "vente"
      referencedColumns: ["id"]
    }
                  ]
                },"client": {
                  Row: {
                    "adresse": string | null,"archive_le": string | null,"cnq": boolean,"code_postal": string | null,"created_at": string,"created_by": string | null,"email": string | null,"gesteos_ref": string | null,"id": string,"magasin_id": string,"nom": string,"prenom": string | null,"raison_sociale": string | null,"rappel_convenu_le": string | null,"source": string | null,"telephone": string | null,"type": string,"updated_at": string,"ville": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adresse"?: string | null,"archive_le"?: string | null,"cnq"?: boolean,"code_postal"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"gesteos_ref"?: string | null,"id"?: string,"magasin_id": string,"nom": string,"prenom"?: string | null,"raison_sociale"?: string | null,"rappel_convenu_le"?: string | null,"source"?: string | null,"telephone"?: string | null,"type"?: string,"updated_at"?: string,"ville"?: string | null
                  }
                  Update: {
                    "adresse"?: string | null,"archive_le"?: string | null,"cnq"?: boolean,"code_postal"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"gesteos_ref"?: string | null,"id"?: string,"magasin_id"?: string,"nom"?: string,"prenom"?: string | null,"raison_sociale"?: string | null,"rappel_convenu_le"?: string | null,"source"?: string | null,"telephone"?: string | null,"type"?: string,"updated_at"?: string,"ville"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_magasin_id_fkey"
      columns: ["magasin_id"]
isOneToOne: false
      referencedRelation: "magasin"
      referencedColumns: ["id"]
    }
                  ]
                },"commande_fournisseur": {
                  Row: {
                    "affaire_id": string,"ar_recu_le": string | null,"arc_recu_le": string | null,"bpa_donne_le": string | null,"bpa_version": string | null,"confirmation_recue_le": string | null,"created_at": string,"created_by": string | null,"envoyee_le": string | null,"fournisseur": string,"gesteos_commande_ref": string | null,"id": string,"iteration": number,"lieu_livraison": string | null,"points": number | null,"prix_achat_cts": number | null,"semaine_annoncee": string | null,"semaine_demandee": string | null,"statut": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affaire_id": string,"ar_recu_le"?: string | null,"arc_recu_le"?: string | null,"bpa_donne_le"?: string | null,"bpa_version"?: string | null,"confirmation_recue_le"?: string | null,"created_at"?: string,"created_by"?: string | null,"envoyee_le"?: string | null,"fournisseur": string,"gesteos_commande_ref"?: string | null,"id"?: string,"iteration"?: number,"lieu_livraison"?: string | null,"points"?: number | null,"prix_achat_cts"?: number | null,"semaine_annoncee"?: string | null,"semaine_demandee"?: string | null,"statut"?: string,"updated_at"?: string
                  }
                  Update: {
                    "affaire_id"?: string,"ar_recu_le"?: string | null,"arc_recu_le"?: string | null,"bpa_donne_le"?: string | null,"bpa_version"?: string | null,"confirmation_recue_le"?: string | null,"created_at"?: string,"created_by"?: string | null,"envoyee_le"?: string | null,"fournisseur"?: string,"gesteos_commande_ref"?: string | null,"id"?: string,"iteration"?: number,"lieu_livraison"?: string | null,"points"?: number | null,"prix_achat_cts"?: number | null,"semaine_annoncee"?: string | null,"semaine_demandee"?: string | null,"statut"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "commande_fournisseur_affaire_id_fkey"
      columns: ["affaire_id"]
isOneToOne: false
      referencedRelation: "affaire"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commande_fournisseur_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"document": {
                  Row: {
                    "affaire_id": string,"created_at": string,"created_by": string | null,"depose_par": string | null,"dossier_pcloud": string,"etape_instance_id": string | null,"id": string,"nom_final": string,"nom_original": string,"pcloud_file_id": string | null,"type_doc": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "affaire_id": string,"created_at"?: string,"created_by"?: string | null,"depose_par"?: string | null,"dossier_pcloud": string,"etape_instance_id"?: string | null,"id"?: string,"nom_final": string,"nom_original": string,"pcloud_file_id"?: string | null,"type_doc": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "affaire_id"?: string,"created_at"?: string,"created_by"?: string | null,"depose_par"?: string | null,"dossier_pcloud"?: string,"etape_instance_id"?: string | null,"id"?: string,"nom_final"?: string,"nom_original"?: string,"pcloud_file_id"?: string | null,"type_doc"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_affaire_id_fkey"
      columns: ["affaire_id"]
isOneToOne: false
      referencedRelation: "affaire"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_depose_par_fkey"
      columns: ["depose_par"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_etape_instance_id_fkey"
      columns: ["etape_instance_id"]
isOneToOne: false
      referencedRelation: "etape_instance"
      referencedColumns: ["id"]
    }
                  ]
                },"echeance": {
                  Row: {
                    "commentaire": string | null,"created_at": string,"created_by": string | null,"date_attendue": string | null,"id": string,"mode": string | null,"montant_prevu_cts": number,"montant_recu_cts": number | null,"ordre": number,"pourcentage": number | null,"recu_le": string | null,"saisi_par": string | null,"type": string,"updated_at": string,"vente_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "commentaire"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_attendue"?: string | null,"id"?: string,"mode"?: string | null,"montant_prevu_cts": number,"montant_recu_cts"?: number | null,"ordre": number,"pourcentage"?: number | null,"recu_le"?: string | null,"saisi_par"?: string | null,"type": string,"updated_at"?: string,"vente_id": string
                  }
                  Update: {
                    "commentaire"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_attendue"?: string | null,"id"?: string,"mode"?: string | null,"montant_prevu_cts"?: number,"montant_recu_cts"?: number | null,"ordre"?: number,"pourcentage"?: number | null,"recu_le"?: string | null,"saisi_par"?: string | null,"type"?: string,"updated_at"?: string,"vente_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "echeance_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "echeance_saisi_par_fkey"
      columns: ["saisi_par"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "echeance_vente_id_fkey"
      columns: ["vente_id"]
isOneToOne: false
      referencedRelation: "vente"
      referencedColumns: ["id"]
    }
                  ]
                },"etape_instance": {
                  Row: {
                    "affaire_id": string,"branche": string,"created_at": string,"created_by": string | null,"debut_at": string | null,"etape_code": string,"fin_at": string | null,"id": string,"issue_code": string | null,"iteration": number,"motif": string | null,"phase_code": string,"statut": string,"updated_at": string,"valide_par": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "affaire_id": string,"branche"?: string,"created_at"?: string,"created_by"?: string | null,"debut_at"?: string | null,"etape_code": string,"fin_at"?: string | null,"id"?: string,"issue_code"?: string | null,"iteration"?: number,"motif"?: string | null,"phase_code": string,"statut"?: string,"updated_at"?: string,"valide_par"?: string | null
                  }
                  Update: {
                    "affaire_id"?: string,"branche"?: string,"created_at"?: string,"created_by"?: string | null,"debut_at"?: string | null,"etape_code"?: string,"fin_at"?: string | null,"id"?: string,"issue_code"?: string | null,"iteration"?: number,"motif"?: string | null,"phase_code"?: string,"statut"?: string,"updated_at"?: string,"valide_par"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "etape_instance_affaire_id_fkey"
      columns: ["affaire_id"]
isOneToOne: false
      referencedRelation: "affaire"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "etape_instance_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "etape_instance_valide_par_fkey"
      columns: ["valide_par"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"journal": {
                  Row: {
                    "action": string,"affaire_id": string | null,"apres": Json | null,"at": string,"auteur_id": string | null,"avant": Json | null,"client_id": string | null,"created_at": string,"id": string,"ligne_id": string | null,"table_nom": string,"vente_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"affaire_id"?: string | null,"apres"?: Json | null,"at"?: string,"auteur_id"?: string | null,"avant"?: Json | null,"client_id"?: string | null,"created_at"?: string,"id"?: string,"ligne_id"?: string | null,"table_nom": string,"vente_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"affaire_id"?: string | null,"apres"?: Json | null,"at"?: string,"auteur_id"?: string | null,"avant"?: Json | null,"client_id"?: string | null,"created_at"?: string,"id"?: string,"ligne_id"?: string | null,"table_nom"?: string,"vente_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_affaire_id_fkey"
      columns: ["affaire_id"]
isOneToOne: false
      referencedRelation: "affaire"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_auteur_id_fkey"
      columns: ["auteur_id"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_vente_id_fkey"
      columns: ["vente_id"]
isOneToOne: false
      referencedRelation: "vente"
      referencedColumns: ["id"]
    }
                  ]
                },"magasin": {
                  Row: {
                    "adresse": string | null,"code": string,"created_at": string,"created_by": string | null,"id": string,"nom": string,"pcloud_root_id": string | null,"societe_id": string,"telephone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adresse"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nom": string,"pcloud_root_id"?: string | null,"societe_id": string,"telephone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "adresse"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nom"?: string,"pcloud_root_id"?: string | null,"societe_id"?: string,"telephone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "magasin_created_by_fk"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "magasin_societe_id_fkey"
      columns: ["societe_id"]
isOneToOne: false
      referencedRelation: "societe"
      referencedColumns: ["id"]
    }
                  ]
                },"mail_sortant": {
                  Row: {
                    "created_at": string,"created_by": string | null,"destinataire_email": string,"destinataire_id": string | null,"envoye_le": string | null,"genere_le": string,"html": string,"id": string,"objet": string,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"destinataire_email": string,"destinataire_id"?: string | null,"envoye_le"?: string | null,"genere_le"?: string,"html": string,"id"?: string,"objet": string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"destinataire_email"?: string,"destinataire_id"?: string | null,"envoye_le"?: string | null,"genere_le"?: string,"html"?: string,"id"?: string,"objet"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mail_sortant_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mail_sortant_destinataire_id_fkey"
      columns: ["destinataire_id"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"parametre": {
                  Row: {
                    "cle": string,"created_at": string,"created_by": string | null,"id": string,"updated_at": string,"valeur": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cle": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"updated_at"?: string,"valeur"?: Json | null
                  }
                  Update: {
                    "cle"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"updated_at"?: string,"valeur"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "parametre_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"planning": {
                  Row: {
                    "commentaire": string | null,"confirme_par": string | null,"created_at": string,"created_by": string | null,"date_pose_confirmee": string | null,"date_pose_souhaitee": string | null,"demande_par": string | null,"id": string,"poseur": string | null,"semaine_livraison_confirmee": string | null,"semaine_livraison_souhaitee": string | null,"statut": string,"updated_at": string,"vente_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "commentaire"?: string | null,"confirme_par"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_pose_confirmee"?: string | null,"date_pose_souhaitee"?: string | null,"demande_par"?: string | null,"id"?: string,"poseur"?: string | null,"semaine_livraison_confirmee"?: string | null,"semaine_livraison_souhaitee"?: string | null,"statut"?: string,"updated_at"?: string,"vente_id": string
                  }
                  Update: {
                    "commentaire"?: string | null,"confirme_par"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_pose_confirmee"?: string | null,"date_pose_souhaitee"?: string | null,"demande_par"?: string | null,"id"?: string,"poseur"?: string | null,"semaine_livraison_confirmee"?: string | null,"semaine_livraison_souhaitee"?: string | null,"statut"?: string,"updated_at"?: string,"vente_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planning_confirme_par_fkey"
      columns: ["confirme_par"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planning_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planning_demande_par_fkey"
      columns: ["demande_par"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planning_vente_id_fkey"
      columns: ["vente_id"]
isOneToOne: true
      referencedRelation: "vente"
      referencedColumns: ["id"]
    }
                  ]
                },"process_version": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"definition": NonNullable<Json>,"id": string,"nom": string,"publiee_le": string | null,"publiee_par": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"definition": NonNullable<Json>,"id"?: string,"nom": string,"publiee_le"?: string | null,"publiee_par"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"definition"?: NonNullable<Json>,"id"?: string,"nom"?: string,"publiee_le"?: string | null,"publiee_par"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "process_version_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "process_version_publiee_par_fkey"
      columns: ["publiee_par"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"profil": {
                  Row: {
                    "actif": boolean,"created_at": string,"created_by": string | null,"email": string,"est_admin": boolean,"id": string,"initiales": string,"nom": string,"prenom": string,"role": string,"rubriques": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actif"?: boolean,"created_at"?: string,"created_by"?: string | null,"email": string,"est_admin"?: boolean,"id": string,"initiales": string,"nom"?: string,"prenom": string,"role": string,"rubriques"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "actif"?: boolean,"created_at"?: string,"created_by"?: string | null,"email"?: string,"est_admin"?: boolean,"id"?: string,"initiales"?: string,"nom"?: string,"prenom"?: string,"role"?: string,"rubriques"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profil_created_by_fk"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"profil_magasin": {
                  Row: {
                    "created_at": string,"created_by": string | null,"magasin_id": string,"profil_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"magasin_id": string,"profil_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"magasin_id"?: string,"profil_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profil_magasin_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profil_magasin_magasin_id_fkey"
      columns: ["magasin_id"]
isOneToOne: false
      referencedRelation: "magasin"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profil_magasin_profil_id_fkey"
      columns: ["profil_id"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"rdv": {
                  Row: {
                    "affaire_id": string | null,"client_id": string,"created_at": string,"created_by": string | null,"debut": string,"id": string,"notes": string | null,"profil_id": string,"rang": number,"statut": string,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affaire_id"?: string | null,"client_id": string,"created_at"?: string,"created_by"?: string | null,"debut": string,"id"?: string,"notes"?: string | null,"profil_id": string,"rang"?: number,"statut"?: string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "affaire_id"?: string | null,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"debut"?: string,"id"?: string,"notes"?: string | null,"profil_id"?: string,"rang"?: number,"statut"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rdv_affaire_id_fkey"
      columns: ["affaire_id"]
isOneToOne: false
      referencedRelation: "affaire"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rdv_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rdv_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rdv_profil_id_fkey"
      columns: ["profil_id"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"societe": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"id": string,"nom": string,"siren": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nom": string,"siren"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nom"?: string,"siren"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "societe_created_by_fk"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"tache": {
                  Row: {
                    "affaire_id": string | null,"assignee_id": string,"created_at": string,"created_by": string | null,"detail": string | null,"echeance": string | null,"etape_instance_id": string | null,"fait_le": string | null,"fait_par": string | null,"id": string,"modele_code": string | null,"optionnelle": boolean,"origine": string,"statut": string,"titre": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affaire_id"?: string | null,"assignee_id": string,"created_at"?: string,"created_by"?: string | null,"detail"?: string | null,"echeance"?: string | null,"etape_instance_id"?: string | null,"fait_le"?: string | null,"fait_par"?: string | null,"id"?: string,"modele_code"?: string | null,"optionnelle"?: boolean,"origine"?: string,"statut"?: string,"titre": string,"updated_at"?: string
                  }
                  Update: {
                    "affaire_id"?: string | null,"assignee_id"?: string,"created_at"?: string,"created_by"?: string | null,"detail"?: string | null,"echeance"?: string | null,"etape_instance_id"?: string | null,"fait_le"?: string | null,"fait_par"?: string | null,"id"?: string,"modele_code"?: string | null,"optionnelle"?: boolean,"origine"?: string,"statut"?: string,"titre"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tache_affaire_id_fkey"
      columns: ["affaire_id"]
isOneToOne: false
      referencedRelation: "affaire"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tache_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tache_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tache_etape_instance_id_fkey"
      columns: ["etape_instance_id"]
isOneToOne: false
      referencedRelation: "etape_instance"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tache_fait_par_fkey"
      columns: ["fait_par"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    }
                  ]
                },"vente": {
                  Row: {
                    "archive_le": string | null,"client_id": string,"commission_saisie_le": string | null,"created_at": string,"created_by": string | null,"date_signature": string,"financement": string,"gesteos_devis_ref": string | null,"id": string,"magasin_id": string,"montant_ht_cts": number,"montant_ttc_cts": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archive_le"?: string | null,"client_id": string,"commission_saisie_le"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_signature": string,"financement"?: string,"gesteos_devis_ref"?: string | null,"id"?: string,"magasin_id": string,"montant_ht_cts": number,"montant_ttc_cts": number,"updated_at"?: string
                  }
                  Update: {
                    "archive_le"?: string | null,"client_id"?: string,"commission_saisie_le"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_signature"?: string,"financement"?: string,"gesteos_devis_ref"?: string | null,"id"?: string,"magasin_id"?: string,"montant_ht_cts"?: number,"montant_ttc_cts"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vente_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vente_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vente_magasin_id_fkey"
      columns: ["magasin_id"]
isOneToOne: false
      referencedRelation: "magasin"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "appliquer_effets":
{ Args: { "affaire_id": string,"effets": Json,"ouvertes": (string)[] }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
