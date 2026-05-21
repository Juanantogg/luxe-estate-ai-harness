/**
 * Tipos generados automáticamente desde el schema de Supabase.
 *
 * No editar a mano. Para regenerar:
 *   pnpm db:types
 * (que internamente llama al MCP de Supabase generate_typescript_types)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      conversations: {
        Row: {
          agent_id: string;
          agent_unread_count: number;
          created_at: string;
          id: string;
          last_message_at: string | null;
          property_id: string;
          user_id: string;
          user_unread_count: number;
        };
        Insert: {
          agent_id: string;
          agent_unread_count?: number;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          property_id: string;
          user_id: string;
          user_unread_count?: number;
        };
        Update: {
          agent_id?: string;
          agent_unread_count?: number;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          property_id?: string;
          user_id?: string;
          user_unread_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_agent_id_fkey';
            columns: ['agent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          property_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          property_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          property_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorites_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          conversation_id: string | null;
          created_at: string;
          id: string;
          property_id: string | null;
          read_at: string | null;
          recipient_id: string;
          title: string;
          type: Database['public']['Enums']['notification_type'];
          visit_id: string | null;
        };
        Insert: {
          body?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          property_id?: string | null;
          read_at?: string | null;
          recipient_id: string;
          title: string;
          type: Database['public']['Enums']['notification_type'];
          visit_id?: string | null;
        };
        Update: {
          body?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          property_id?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          title?: string;
          type?: Database['public']['Enums']['notification_type'];
          visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_visit_id_fkey';
            columns: ['visit_id'];
            isOneToOne: false;
            referencedRelation: 'visits';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          city: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          is_active: boolean;
          member_since: string;
          phone: string | null;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          member_since?: string;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          member_since?: string;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          address_line: string;
          area_sqm: number | null;
          bathrooms: number;
          bedrooms: number;
          city: string;
          country: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_featured: boolean;
          is_premium: boolean;
          latitude: number | null;
          listing_status: Database['public']['Enums']['listing_status'];
          listing_type: Database['public']['Enums']['listing_type'];
          longitude: number | null;
          owner_id: string;
          parking_spaces: number | null;
          postal_code: string | null;
          previous_price: number | null;
          price: number;
          property_type: Database['public']['Enums']['property_type'];
          published_at: string | null;
          search_vector: unknown;
          state: string | null;
          title: string;
          updated_at: string;
          year_built: number | null;
        };
        Insert: {
          address_line: string;
          area_sqm?: number | null;
          bathrooms?: number;
          bedrooms?: number;
          city: string;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          is_premium?: boolean;
          latitude?: number | null;
          listing_status?: Database['public']['Enums']['listing_status'];
          listing_type: Database['public']['Enums']['listing_type'];
          longitude?: number | null;
          owner_id: string;
          parking_spaces?: number | null;
          postal_code?: string | null;
          previous_price?: number | null;
          price: number;
          property_type: Database['public']['Enums']['property_type'];
          published_at?: string | null;
          search_vector?: unknown;
          state?: string | null;
          title: string;
          updated_at?: string;
          year_built?: number | null;
        };
        Update: {
          address_line?: string;
          area_sqm?: number | null;
          bathrooms?: number;
          bedrooms?: number;
          city?: string;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          is_premium?: boolean;
          latitude?: number | null;
          listing_status?: Database['public']['Enums']['listing_status'];
          listing_type?: Database['public']['Enums']['listing_type'];
          longitude?: number | null;
          owner_id?: string;
          parking_spaces?: number | null;
          postal_code?: string | null;
          previous_price?: number | null;
          price?: number;
          property_type?: Database['public']['Enums']['property_type'];
          published_at?: string | null;
          search_vector?: unknown;
          state?: string | null;
          title?: string;
          updated_at?: string;
          year_built?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'properties_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      property_amenities: {
        Row: {
          amenity: Database['public']['Enums']['amenity_key'];
          property_id: string;
        };
        Insert: {
          amenity: Database['public']['Enums']['amenity_key'];
          property_id: string;
        };
        Update: {
          amenity?: Database['public']['Enums']['amenity_key'];
          property_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_amenities_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
        ];
      };
      property_images: {
        Row: {
          alt_text: string | null;
          created_at: string;
          id: string;
          is_main: boolean;
          position: number;
          property_id: string;
          storage_path: string;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          is_main?: boolean;
          position?: number;
          property_id: string;
          storage_path: string;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          is_main?: boolean;
          position?: number;
          property_id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_images_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
        ];
      };
      visits: {
        Row: {
          agent_id: string;
          agent_notes: string | null;
          created_at: string;
          duration_minutes: number;
          id: string;
          message: string | null;
          property_id: string;
          scheduled_at: string;
          status: Database['public']['Enums']['visit_status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agent_id: string;
          agent_notes?: string | null;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          message?: string | null;
          property_id: string;
          scheduled_at: string;
          status?: Database['public']['Enums']['visit_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agent_id?: string;
          agent_notes?: string | null;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          message?: string | null;
          property_id?: string;
          scheduled_at?: string;
          status?: Database['public']['Enums']['visit_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'visits_agent_id_fkey';
            columns: ['agent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visits_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visits_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_user_role: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      is_admin: { Args: never; Returns: boolean };
      is_agent_or_above: { Args: never; Returns: boolean };
    };
    Enums: {
      amenity_key:
        | 'pool'
        | 'gym'
        | 'wifi'
        | 'air_conditioning'
        | 'garden'
        | 'smart_home'
        | 'parking'
        | 'patio'
        | 'wine_cellar'
        | 'ev_charging'
        | 'central_heating';
      listing_status: 'draft' | 'active' | 'pending' | 'sold' | 'rented' | 'archived';
      listing_type: 'sale' | 'rent';
      notification_type:
        | 'new_property'
        | 'visit_confirmed'
        | 'visit_reminder'
        | 'new_message'
        | 'price_drop'
        | 'favorite_update'
        | 'system';
      property_type:
        | 'house'
        | 'apartment'
        | 'villa'
        | 'penthouse'
        | 'condo'
        | 'townhouse'
        | 'commercial';
      user_role: 'user' | 'agent' | 'broker' | 'admin';
      visit_status: 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed' | 'no_show';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      amenity_key: [
        'pool',
        'gym',
        'wifi',
        'air_conditioning',
        'garden',
        'smart_home',
        'parking',
        'patio',
        'wine_cellar',
        'ev_charging',
        'central_heating',
      ],
      listing_status: ['draft', 'active', 'pending', 'sold', 'rented', 'archived'],
      listing_type: ['sale', 'rent'],
      notification_type: [
        'new_property',
        'visit_confirmed',
        'visit_reminder',
        'new_message',
        'price_drop',
        'favorite_update',
        'system',
      ],
      property_type: [
        'house',
        'apartment',
        'villa',
        'penthouse',
        'condo',
        'townhouse',
        'commercial',
      ],
      user_role: ['user', 'agent', 'broker', 'admin'],
      visit_status: ['pending', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show'],
    },
  },
} as const;
