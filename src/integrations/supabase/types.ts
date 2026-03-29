export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message: string
          severity: string
          title: string
          type: string
          zone: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message: string
          severity: string
          title: string
          type: string
          zone: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          severity?: string
          title?: string
          type?: string
          zone?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          last_updated: string | null
          metadata: Json
          name: string
          provider: string
          slug: string
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          last_updated?: string | null
          metadata?: Json
          name: string
          provider: string
          slug: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          last_updated?: string | null
          metadata?: Json
          name?: string
          provider?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      citizen_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          location_lat: number
          location_lng: number
          location_name: string
          trust_score: number
          type: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          location_lat: number
          location_lng: number
          location_name: string
          trust_score?: number
          type: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          location_lat?: number
          location_lng?: number
          location_name?: string
          trust_score?: number
          type?: string
          verified?: boolean
        }
        Relationships: []
      }
      glacial_lakes: {
        Row: {
          area: number
          dam_type: string
          district: string
          downstream_population: number
          elevation: number
          id: string
          location_lat: number
          location_lng: number
          name: string
          region: string
          risk_level: string
          trend: string
          updated_at: string
          volume: number
        }
        Insert: {
          area: number
          dam_type: string
          district: string
          downstream_population?: number
          elevation: number
          id?: string
          location_lat: number
          location_lng: number
          name: string
          region: string
          risk_level: string
          trend: string
          updated_at?: string
          volume: number
        }
        Update: {
          area?: number
          dam_type?: string
          district?: string
          downstream_population?: number
          elevation?: number
          id?: string
          location_lat?: number
          location_lng?: number
          name?: string
          region?: string
          risk_level?: string
          trend?: string
          updated_at?: string
          volume?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      rainfall_forecasts: {
        Row: {
          basin: string
          created_at: string
          forecast_date: string
          id: string
          model: string
          probability: number
          rainfall_mm: number
          source: string
        }
        Insert: {
          basin: string
          created_at?: string
          forecast_date: string
          id?: string
          model: string
          probability: number
          rainfall_mm: number
          source?: string
        }
        Update: {
          basin?: string
          created_at?: string
          forecast_date?: string
          id?: string
          model?: string
          probability?: number
          rainfall_mm?: number
          source?: string
        }
        Relationships: []
      }
      risk_zones: {
        Row: {
          center_lat: number
          center_lng: number
          district: string
          flood_probability: number
          id: string
          landslide_probability: number
          name: string
          population: number
          risk_level: string
          source: string
          updated_at: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          district: string
          flood_probability: number
          id?: string
          landslide_probability: number
          name: string
          population?: number
          risk_level: string
          source?: string
          updated_at?: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          district?: string
          flood_probability?: number
          id?: string
          landslide_probability?: number
          name?: string
          population?: number
          risk_level?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      river_level_observations: {
        Row: {
          actual_level: number | null
          created_at: string
          danger_level: number
          id: string
          observed_at: string
          predicted_level: number | null
          source: string
          station_id: string
          warning_level: number
        }
        Insert: {
          actual_level?: number | null
          created_at?: string
          danger_level: number
          id?: string
          observed_at: string
          predicted_level?: number | null
          source?: string
          station_id: string
          warning_level: number
        }
        Update: {
          actual_level?: number | null
          created_at?: string
          danger_level?: number
          id?: string
          observed_at?: string
          predicted_level?: number | null
          source?: string
          station_id?: string
          warning_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "river_level_observations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "river_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      river_stations: {
        Row: {
          current_level: number
          danger_level: number
          id: string
          last_updated: string
          location_lat: number
          location_lng: number
          name: string
          risk_level: string
          source: string
          trend: string
          warning_level: number
        }
        Insert: {
          current_level: number
          danger_level: number
          id?: string
          last_updated?: string
          location_lat: number
          location_lng: number
          name: string
          risk_level: string
          source?: string
          trend: string
          warning_level: number
        }
        Update: {
          current_level?: number
          danger_level?: number
          id?: string
          last_updated?: string
          location_lat?: number
          location_lng?: number
          name?: string
          risk_level?: string
          source?: string
          trend?: string
          warning_level?: number
        }
        Relationships: []
      }
      satellite_products: {
        Row: {
          cloud_cover: number | null
          flood_area_km2: number | null
          footprint_geojson: Json | null
          id: string
          ingested_at: string
          is_latest: boolean
          metadata: Json
          observed_at: string
          product_type: string
          product_url: string | null
          region_name: string
          resolution_meters: number | null
          risk_level: string | null
          source_slug: string
          thumbnail_url: string | null
        }
        Insert: {
          cloud_cover?: number | null
          flood_area_km2?: number | null
          footprint_geojson?: Json | null
          id?: string
          ingested_at?: string
          is_latest?: boolean
          metadata?: Json
          observed_at: string
          product_type: string
          product_url?: string | null
          region_name: string
          resolution_meters?: number | null
          risk_level?: string | null
          source_slug: string
          thumbnail_url?: string | null
        }
        Update: {
          cloud_cover?: number | null
          flood_area_km2?: number | null
          footprint_geojson?: Json | null
          id?: string
          ingested_at?: string
          is_latest?: boolean
          metadata?: Json
          observed_at?: string
          product_type?: string
          product_url?: string | null
          region_name?: string
          resolution_meters?: number | null
          risk_level?: string | null
          source_slug?: string
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      sentinel_scenes: {
        Row: {
          assets_json: Json | null
          bbox_east: number
          bbox_north: number
          bbox_south: number
          bbox_west: number
          cloud_cover: number | null
          collection: string
          geometry: Json | null
          id: string
          ingested_at: string
          instrument_mode: string | null
          mgrs_tile: string | null
          orbit_state: string | null
          platform: string | null
          polarizations: Json | null
          processing_baseline: string | null
          scene_datetime: string
          scene_id: string
          stac_item_url: string | null
          use_case: string
        }
        Insert: {
          assets_json?: Json | null
          bbox_east: number
          bbox_north: number
          bbox_south: number
          bbox_west: number
          cloud_cover?: number | null
          collection: string
          geometry?: Json | null
          id?: string
          ingested_at?: string
          instrument_mode?: string | null
          mgrs_tile?: string | null
          orbit_state?: string | null
          platform?: string | null
          polarizations?: Json | null
          processing_baseline?: string | null
          scene_datetime: string
          scene_id: string
          stac_item_url?: string | null
          use_case: string
        }
        Update: {
          assets_json?: Json | null
          bbox_east?: number
          bbox_north?: number
          bbox_south?: number
          bbox_west?: number
          cloud_cover?: number | null
          collection?: string
          geometry?: Json | null
          id?: string
          ingested_at?: string
          instrument_mode?: string | null
          mgrs_tile?: string | null
          orbit_state?: string | null
          platform?: string | null
          polarizations?: Json | null
          processing_baseline?: string | null
          scene_datetime?: string
          scene_id?: string
          stac_item_url?: string | null
          use_case?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
