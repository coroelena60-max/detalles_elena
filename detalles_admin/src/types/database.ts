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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bitacora: {
        Row: {
          accion: string
          created_at: string
          datos_antes: Json | null
          datos_despues: Json | null
          entidad: string
          entidad_id: string | null
          id: number
          nota: string | null
          perfil_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          datos_antes?: Json | null
          datos_despues?: Json | null
          entidad: string
          entidad_id?: string | null
          id?: never
          nota?: string | null
          perfil_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          datos_antes?: Json | null
          datos_despues?: Json | null
          entidad?: string
          entidad_id?: string | null
          id?: never
          nota?: string | null
          perfil_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria: {
        Row: {
          activa: boolean
          created_at: string
          descripcion: string | null
          id: number
          imagen_url: string | null
          nombre: string
          orden: number
          slug: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: never
          imagen_url?: string | null
          nombre: string
          orden?: number
          slug: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: never
          imagen_url?: string | null
          nombre?: string
          orden?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      categoria_gasto: {
        Row: {
          activa: boolean
          created_at: string
          descripcion: string | null
          id: number
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: never
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: never
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      cliente: {
        Row: {
          created_at: string
          email: string | null
          id: number
          nombre: string
          notas: string | null
          telefono: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          nombre: string
          notas?: string | null
          telefono: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          nombre?: string
          notas?: string | null
          telefono?: string
          updated_at?: string
        }
        Relationships: []
      }
      compra: {
        Row: {
          codigo: string | null
          created_at: string
          descuento: number
          documento: string | null
          estado: Database["public"]["Enums"]["estado_compra"]
          fecha: string
          id: number
          nota: string | null
          proveedor_id: number | null
          recibida_at: string | null
          registrado_por: string | null
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descuento?: number
          documento?: string | null
          estado?: Database["public"]["Enums"]["estado_compra"]
          fecha?: string
          id?: never
          nota?: string | null
          proveedor_id?: number | null
          recibida_at?: string | null
          registrado_por?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descuento?: number
          documento?: string | null
          estado?: Database["public"]["Enums"]["estado_compra"]
          fecha?: string
          id?: never
          nota?: string | null
          proveedor_id?: number | null
          recibida_at?: string | null
          registrado_por?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_item: {
        Row: {
          cantidad: number
          compra_id: number
          costo_unitario: number
          created_at: string
          id: number
          insumo_id: number
          nota: string | null
          subtotal: number
          updated_at: string
        }
        Insert: {
          cantidad: number
          compra_id: number
          costo_unitario: number
          created_at?: string
          id?: never
          insumo_id: number
          nota?: string | null
          subtotal?: number
          updated_at?: string
        }
        Update: {
          cantidad?: number
          compra_id?: number
          costo_unitario?: number
          created_at?: string
          id?: never
          insumo_id?: number
          nota?: string | null
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compra_item_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_item_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_item_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_item_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_consumo_insumo"
            referencedColumns: ["insumo_id"]
          },
        ]
      }
      cotizacion: {
        Row: {
          codigo: string | null
          costo_hora: number
          creado_por: string | null
          created_at: string
          descripcion: string | null
          id: number
          margen_pct: number
          minutos: number
          nombre: string
          otros_monto: number
          otros_pct: number
          precio_final: number | null
          producto_id: number | null
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          costo_hora?: number
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          id?: never
          margen_pct?: number
          minutos?: number
          nombre: string
          otros_monto?: number
          otros_pct?: number
          precio_final?: number | null
          producto_id?: number | null
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          costo_hora?: number
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          id?: never
          margen_pct?: number
          minutos?: number
          nombre?: string
          otros_monto?: number
          otros_pct?: number
          precio_final?: number | null
          producto_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_costo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_margen_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_producto_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_extra: {
        Row: {
          cantidad: number
          costo_unitario: number
          cotizacion_id: number
          extra_id: number | null
          id: number
          nombre: string
          orden: number
        }
        Insert: {
          cantidad: number
          costo_unitario?: number
          cotizacion_id: number
          extra_id?: number | null
          id?: never
          nombre: string
          orden?: number
        }
        Update: {
          cantidad?: number
          costo_unitario?: number
          cotizacion_id?: number
          extra_id?: number | null
          id?: never
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_extra_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_extra_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "v_cotizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_costo_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_extra_vendido"
            referencedColumns: ["extra_id"]
          },
        ]
      }
      cotizacion_material: {
        Row: {
          cantidad_compra: number
          cantidad_usada: number
          cotizacion_id: number
          factor: number
          id: number
          insumo_id: number | null
          nombre: string
          orden: number
          precio_compra: number
          unidad: Database["public"]["Enums"]["unidad_medida"]
        }
        Insert: {
          cantidad_compra: number
          cantidad_usada: number
          cotizacion_id: number
          factor?: number
          id?: never
          insumo_id?: number | null
          nombre: string
          orden?: number
          precio_compra: number
          unidad?: Database["public"]["Enums"]["unidad_medida"]
        }
        Update: {
          cantidad_compra?: number
          cantidad_usada?: number
          cotizacion_id?: number
          factor?: number
          id?: never
          insumo_id?: number | null
          nombre?: string
          orden?: number
          precio_compra?: number
          unidad?: Database["public"]["Enums"]["unidad_medida"]
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_material_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_material_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "v_cotizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_material_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_material_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_material_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_consumo_insumo"
            referencedColumns: ["insumo_id"]
          },
        ]
      }
      entrega: {
        Row: {
          created_at: string
          destinatario: string | null
          direccion: string
          fecha_entrega: string | null
          franja_horaria: string | null
          instrucciones: string | null
          pedido_id: number
          referencia: string | null
          telefono: string | null
          updated_at: string
          zona_envio_id: number | null
        }
        Insert: {
          created_at?: string
          destinatario?: string | null
          direccion: string
          fecha_entrega?: string | null
          franja_horaria?: string | null
          instrucciones?: string | null
          pedido_id: number
          referencia?: string | null
          telefono?: string | null
          updated_at?: string
          zona_envio_id?: number | null
        }
        Update: {
          created_at?: string
          destinatario?: string | null
          direccion?: string
          fecha_entrega?: string | null
          franja_horaria?: string | null
          instrucciones?: string | null
          pedido_id?: number
          referencia?: string | null
          telefono?: string | null
          updated_at?: string
          zona_envio_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entrega_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrega_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "v_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrega_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "v_pedido_saldo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrega_zona_envio_id_fkey"
            columns: ["zona_envio_id"]
            isOneToOne: false
            referencedRelation: "zona_envio"
            referencedColumns: ["id"]
          },
        ]
      }
      envoltorio: {
        Row: {
          activo: boolean
          created_at: string
          espacios: number | null
          estilo_id: number
          id: number
          minutos_armado: number | null
          precio_base: number
          tamano_id: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          espacios?: number | null
          estilo_id: number
          id?: never
          minutos_armado?: number | null
          precio_base?: number
          tamano_id: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          espacios?: number | null
          estilo_id?: number
          id?: never
          minutos_armado?: number | null
          precio_base?: number
          tamano_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "envoltorio_estilo_id_fkey"
            columns: ["estilo_id"]
            isOneToOne: false
            referencedRelation: "estilo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envoltorio_tamano_id_fkey"
            columns: ["tamano_id"]
            isOneToOne: false
            referencedRelation: "tamano"
            referencedColumns: ["id"]
          },
        ]
      }
      envoltorio_insumo: {
        Row: {
          cantidad: number
          created_at: string
          envoltorio_id: number
          id: number
          insumo_id: number
          nota: string | null
          updated_at: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          envoltorio_id: number
          id?: never
          insumo_id: number
          nota?: string | null
          updated_at?: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          envoltorio_id?: number
          id?: never
          insumo_id?: number
          nota?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "envoltorio_insumo_envoltorio_id_fkey"
            columns: ["envoltorio_id"]
            isOneToOne: false
            referencedRelation: "envoltorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envoltorio_insumo_envoltorio_id_fkey"
            columns: ["envoltorio_id"]
            isOneToOne: false
            referencedRelation: "v_costo_envoltorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envoltorio_insumo_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envoltorio_insumo_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envoltorio_insumo_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_consumo_insumo"
            referencedColumns: ["insumo_id"]
          },
        ]
      }
      estilo: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: number
          nombre: string
          orden: number
          slug: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: never
          nombre: string
          orden?: number
          slug: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: never
          nombre?: string
          orden?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      extra: {
        Row: {
          created_at: string
          descripcion: string | null
          espacios: number
          estado: Database["public"]["Enums"]["estado_publicacion"]
          extra_categoria_id: number | null
          id: number
          imagen_url: string | null
          minutos_armado: number | null
          nombre: string
          orden: number
          precio: number
          slug: string
          stock_minimo: number
          unidad: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          espacios?: number
          estado?: Database["public"]["Enums"]["estado_publicacion"]
          extra_categoria_id?: number | null
          id?: never
          imagen_url?: string | null
          minutos_armado?: number | null
          nombre: string
          orden?: number
          precio: number
          slug: string
          stock_minimo?: number
          unidad?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          espacios?: number
          estado?: Database["public"]["Enums"]["estado_publicacion"]
          extra_categoria_id?: number | null
          id?: never
          imagen_url?: string | null
          minutos_armado?: number | null
          nombre?: string
          orden?: number
          precio?: number
          slug?: string
          stock_minimo?: number
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_extra_categoria_id_fkey"
            columns: ["extra_categoria_id"]
            isOneToOne: false
            referencedRelation: "extra_categoria"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_categoria: {
        Row: {
          activa: boolean
          created_at: string
          id: number
          nombre: string
          orden: number
          slug: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: never
          nombre: string
          orden?: number
          slug: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: never
          nombre?: string
          orden?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      extra_insumo: {
        Row: {
          cantidad: number
          created_at: string
          extra_id: number
          id: number
          insumo_id: number
          nota: string | null
          updated_at: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          extra_id: number
          id?: never
          insumo_id: number
          nota?: string | null
          updated_at?: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          extra_id?: number
          id?: never
          insumo_id?: number
          nota?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_insumo_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_insumo_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_costo_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_insumo_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_insumo_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_extra_vendido"
            referencedColumns: ["extra_id"]
          },
          {
            foreignKeyName: "extra_insumo_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_insumo_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_insumo_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_consumo_insumo"
            referencedColumns: ["insumo_id"]
          },
        ]
      }
      gasto: {
        Row: {
          anulado_at: string | null
          anulado_por: string | null
          categoria_gasto_id: number
          codigo: string | null
          comprobante: string | null
          created_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["estado_gasto"]
          fecha: string
          id: number
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          motivo_anulacion: string | null
          nota: string | null
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          anulado_at?: string | null
          anulado_por?: string | null
          categoria_gasto_id: number
          codigo?: string | null
          comprobante?: string | null
          created_at?: string
          descripcion: string
          estado?: Database["public"]["Enums"]["estado_gasto"]
          fecha?: string
          id?: never
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          motivo_anulacion?: string | null
          nota?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          anulado_at?: string | null
          anulado_por?: string | null
          categoria_gasto_id?: number
          codigo?: string | null
          comprobante?: string | null
          created_at?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_gasto"]
          fecha?: string
          id?: never
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          motivo_anulacion?: string | null
          nota?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gasto_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gasto_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gasto_categoria_gasto_id_fkey"
            columns: ["categoria_gasto_id"]
            isOneToOne: false
            referencedRelation: "categoria_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gasto_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gasto_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      insumo: {
        Row: {
          activo: boolean
          costo_unitario: number
          created_at: string
          descripcion: string | null
          id: number
          nombre: string
          proveedor_id: number | null
          slug: string
          stock_minimo: number
          unidad: Database["public"]["Enums"]["unidad_medida"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          costo_unitario?: number
          created_at?: string
          descripcion?: string | null
          id?: never
          nombre: string
          proveedor_id?: number | null
          slug: string
          stock_minimo?: number
          unidad?: Database["public"]["Enums"]["unidad_medida"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          costo_unitario?: number
          created_at?: string
          descripcion?: string | null
          id?: never
          nombre?: string
          proveedor_id?: number | null
          slug?: string
          stock_minimo?: number
          unidad?: Database["public"]["Enums"]["unidad_medida"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumo_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento_inventario: {
        Row: {
          cantidad: number
          compra_id: number | null
          costo_unitario: number
          created_at: string
          extra_id: number | null
          id: number
          insumo_id: number | null
          nota: string | null
          pedido_id: number | null
          perfil_id: string | null
          producto_id: number | null
          referencia: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          tipo_item: Database["public"]["Enums"]["tipo_item_inventario"]
        }
        Insert: {
          cantidad: number
          compra_id?: number | null
          costo_unitario?: number
          created_at?: string
          extra_id?: number | null
          id?: never
          insumo_id?: number | null
          nota?: string | null
          pedido_id?: number | null
          perfil_id?: string | null
          producto_id?: number | null
          referencia?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          tipo_item: Database["public"]["Enums"]["tipo_item_inventario"]
        }
        Update: {
          cantidad?: number
          compra_id?: number | null
          costo_unitario?: number
          created_at?: string
          extra_id?: number | null
          id?: never
          insumo_id?: number | null
          nota?: string | null
          pedido_id?: number | null
          perfil_id?: string | null
          producto_id?: number | null
          referencia?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          tipo_item?: Database["public"]["Enums"]["tipo_item_inventario"]
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_inventario_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_costo_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_extra_vendido"
            referencedColumns: ["extra_id"]
          },
          {
            foreignKeyName: "movimiento_inventario_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_consumo_insumo"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "movimiento_inventario_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_saldo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_costo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_margen_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_producto_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      pago: {
        Row: {
          created_at: string
          fecha: string
          id: number
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          nota: string | null
          pedido_id: number
          referencia: string | null
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fecha?: string
          id?: never
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          nota?: string | null
          pedido_id: number
          referencia?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: never
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          nota?: string | null
          pedido_id?: number
          referencia?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_saldo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      parametro: {
        Row: {
          clave: string
          descripcion: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          clave: string
          descripcion?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          clave?: string
          descripcion?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      pedido: {
        Row: {
          atendido_por: string | null
          canal: string
          cliente_id: number | null
          codigo: string | null
          costo_envio: number
          created_at: string
          descuento: number
          entregado_at: string | null
          enviado_whatsapp_at: string | null
          estado: Database["public"]["Enums"]["estado_pedido"]
          fecha_compromiso: string | null
          id: number
          nota_cliente: string | null
          nota_interna: string | null
          subtotal: number
          tipo_entrega: Database["public"]["Enums"]["tipo_entrega"]
          total: number
          updated_at: string
        }
        Insert: {
          atendido_por?: string | null
          canal?: string
          cliente_id?: number | null
          codigo?: string | null
          costo_envio?: number
          created_at?: string
          descuento?: number
          entregado_at?: string | null
          enviado_whatsapp_at?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          fecha_compromiso?: string | null
          id?: never
          nota_cliente?: string | null
          nota_interna?: string | null
          subtotal?: number
          tipo_entrega?: Database["public"]["Enums"]["tipo_entrega"]
          total?: number
          updated_at?: string
        }
        Update: {
          atendido_por?: string | null
          canal?: string
          cliente_id?: number | null
          codigo?: string | null
          costo_envio?: number
          created_at?: string
          descuento?: number
          entregado_at?: string | null
          enviado_whatsapp_at?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          fecha_compromiso?: string | null
          id?: never
          nota_cliente?: string | null
          nota_interna?: string | null
          subtotal?: number
          tipo_entrega?: Database["public"]["Enums"]["tipo_entrega"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_cliente_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_item: {
        Row: {
          cantidad: number
          cotizacion_id: number | null
          created_at: string
          dedicatoria: string | null
          envoltorio_id: number | null
          extra_id: number | null
          id: number
          nombre: string
          nota: string | null
          pedido_id: number
          precio_unitario: number
          producto_id: number | null
          subtotal: number
          tipo: Database["public"]["Enums"]["tipo_item_pedido"]
          updated_at: string
        }
        Insert: {
          cantidad?: number
          cotizacion_id?: number | null
          created_at?: string
          dedicatoria?: string | null
          envoltorio_id?: number | null
          extra_id?: number | null
          id?: never
          nombre: string
          nota?: string | null
          pedido_id: number
          precio_unitario: number
          producto_id?: number | null
          subtotal: number
          tipo: Database["public"]["Enums"]["tipo_item_pedido"]
          updated_at?: string
        }
        Update: {
          cantidad?: number
          cotizacion_id?: number | null
          created_at?: string
          dedicatoria?: string | null
          envoltorio_id?: number | null
          extra_id?: number | null
          id?: never
          nombre?: string
          nota?: string | null
          pedido_id?: number
          precio_unitario?: number
          producto_id?: number | null
          subtotal?: number
          tipo?: Database["public"]["Enums"]["tipo_item_pedido"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "v_cotizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_envoltorio_id_fkey"
            columns: ["envoltorio_id"]
            isOneToOne: false
            referencedRelation: "envoltorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_envoltorio_id_fkey"
            columns: ["envoltorio_id"]
            isOneToOne: false
            referencedRelation: "v_costo_envoltorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_costo_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_extra_vendido"
            referencedColumns: ["extra_id"]
          },
          {
            foreignKeyName: "pedido_item_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_saldo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_costo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_margen_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_producto_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_item_extra: {
        Row: {
          cantidad: number
          created_at: string
          extra_id: number | null
          id: number
          nombre: string
          pedido_item_id: number
          precio_unitario: number
          subtotal: number
          updated_at: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          extra_id?: number | null
          id?: never
          nombre: string
          pedido_item_id: number
          precio_unitario: number
          subtotal: number
          updated_at?: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          extra_id?: number | null
          id?: never
          nombre?: string
          pedido_item_id?: number
          precio_unitario?: number
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_costo_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_extra_vendido"
            referencedColumns: ["extra_id"]
          },
          {
            foreignKeyName: "pedido_item_extra_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_item"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil: {
        Row: {
          activo: boolean
          created_at: string
          email: string | null
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      permiso: {
        Row: {
          codigo: string
          created_at: string
          descripcion: string | null
          id: number
          modulo: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: never
          modulo: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: never
          modulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      producto: {
        Row: {
          categoria_id: number
          codigo: string
          created_at: string
          descripcion: string | null
          destacado: boolean
          envoltorio_id: number | null
          estado: Database["public"]["Enums"]["estado_publicacion"]
          id: number
          lead_time_dias: number | null
          minutos_armado: number | null
          nombre: string
          orden: number
          precio: number
          precio_desde: boolean
          slug: string
          stock_minimo: number
          updated_at: string
        }
        Insert: {
          categoria_id: number
          codigo: string
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          envoltorio_id?: number | null
          estado?: Database["public"]["Enums"]["estado_publicacion"]
          id?: never
          lead_time_dias?: number | null
          minutos_armado?: number | null
          nombre: string
          orden?: number
          precio: number
          precio_desde?: boolean
          slug: string
          stock_minimo?: number
          updated_at?: string
        }
        Update: {
          categoria_id?: number
          codigo?: string
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          envoltorio_id?: number | null
          estado?: Database["public"]["Enums"]["estado_publicacion"]
          id?: never
          lead_time_dias?: number | null
          minutos_armado?: number | null
          nombre?: string
          orden?: number
          precio?: number
          precio_desde?: boolean
          slug?: string
          stock_minimo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "producto_envoltorio_id_fkey"
            columns: ["envoltorio_id"]
            isOneToOne: false
            referencedRelation: "envoltorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_envoltorio_id_fkey"
            columns: ["envoltorio_id"]
            isOneToOne: false
            referencedRelation: "v_costo_envoltorio"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_extra: {
        Row: {
          cantidad: number
          created_at: string
          extra_id: number
          id: number
          producto_id: number
          updated_at: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          extra_id: number
          id?: never
          producto_id: number
          updated_at?: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          extra_id?: number
          id?: never
          producto_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_costo_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_extra_vendido"
            referencedColumns: ["extra_id"]
          },
          {
            foreignKeyName: "producto_extra_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_extra_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_extra_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_costo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_extra_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_extra_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_margen_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_extra_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_producto_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_imagen: {
        Row: {
          alt: string | null
          created_at: string
          es_principal: boolean
          id: number
          orden: number
          producto_id: number
          storage_path: string | null
          updated_at: string
          url: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          es_principal?: boolean
          id?: never
          orden?: number
          producto_id: number
          storage_path?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          es_principal?: boolean
          id?: never
          orden?: number
          producto_id?: number
          storage_path?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_imagen_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagen_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagen_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_costo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagen_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagen_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_margen_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagen_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_producto_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_insumo: {
        Row: {
          cantidad: number
          created_at: string
          id: number
          insumo_id: number
          nota: string | null
          producto_id: number
          updated_at: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: never
          insumo_id: number
          nota?: string | null
          producto_id: number
          updated_at?: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: never
          insumo_id?: number
          nota?: string | null
          producto_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_insumo_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_insumo_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_insumo_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_consumo_insumo"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "producto_insumo_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_insumo_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_insumo_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_costo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_insumo_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_insumo_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_margen_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_insumo_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_producto_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedor: {
        Row: {
          activo: boolean
          created_at: string
          direccion: string | null
          email: string | null
          id: number
          nombre: string
          notas: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: never
          nombre: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: never
          nombre?: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rol: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          es_sistema: boolean
          id: number
          nombre: string
          slug: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          es_sistema?: boolean
          id?: never
          nombre: string
          slug: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          es_sistema?: boolean
          id?: never
          nombre?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      rol_permiso: {
        Row: {
          created_at: string
          permiso_id: number
          rol_id: number
        }
        Insert: {
          created_at?: string
          permiso_id: number
          rol_id: number
        }
        Update: {
          created_at?: string
          permiso_id?: number
          rol_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rol_permiso_permiso_id_fkey"
            columns: ["permiso_id"]
            isOneToOne: false
            referencedRelation: "permiso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rol_permiso_permiso_id_fkey"
            columns: ["permiso_id"]
            isOneToOne: false
            referencedRelation: "v_rol_permiso"
            referencedColumns: ["permiso_id"]
          },
          {
            foreignKeyName: "rol_permiso_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "rol"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rol_permiso_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "v_rol_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rol_permiso_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "v_rol_permiso"
            referencedColumns: ["rol_id"]
          },
        ]
      }
      tamano: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          id: number
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          id?: never
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          id?: never
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      usuario_rol: {
        Row: {
          created_at: string
          perfil_id: string
          rol_id: number
        }
        Insert: {
          created_at?: string
          perfil_id: string
          rol_id: number
        }
        Update: {
          created_at?: string
          perfil_id?: string
          rol_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "usuario_rol_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_rol_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_rol_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "rol"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_rol_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "v_rol_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_rol_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "v_rol_permiso"
            referencedColumns: ["rol_id"]
          },
        ]
      }
      zona_envio: {
        Row: {
          activa: boolean
          costo_referencia: number | null
          created_at: string
          id: number
          nombre: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          costo_referencia?: number | null
          created_at?: string
          id?: never
          nombre: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          costo_referencia?: number | null
          created_at?: string
          id?: never
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_agenda: {
        Row: {
          canal: string | null
          cliente: string | null
          codigo: string | null
          created_at: string | null
          direccion: string | null
          estado: Database["public"]["Enums"]["estado_pedido"] | null
          fecha_compromiso: string | null
          franja_horaria: string | null
          id: number | null
          minutos: number | null
          resumen: string | null
          telefono: string | null
          tipo_entrega: Database["public"]["Enums"]["tipo_entrega"] | null
          total: number | null
        }
        Relationships: []
      }
      v_catalogo_producto: {
        Row: {
          categoria_id: number | null
          categoria_nombre: string | null
          categoria_slug: string | null
          codigo: string | null
          descripcion: string | null
          destacado: boolean | null
          espacios_capacidad: number | null
          estado: Database["public"]["Enums"]["estado_publicacion"] | null
          estilo_nombre: string | null
          id: number | null
          imagen_principal: string | null
          lead_time_dias: number | null
          nombre: string | null
          orden: number | null
          precio: number | null
          precio_desde: boolean | null
          slug: string | null
          tamano_codigo: string | null
          tamano_nombre: string | null
        }
        Relationships: []
      }
      v_cliente_resumen: {
        Row: {
          created_at: string | null
          email: string | null
          id: number | null
          nombre: string | null
          notas: string | null
          pedidos: number | null
          pedidos_confirmados: number | null
          saldo_pendiente: number | null
          telefono: string | null
          total_comprado: number | null
          ultimo_pedido: string | null
        }
        Relationships: []
      }
      v_costo_envoltorio: {
        Row: {
          costo_mano_obra: number | null
          costo_materiales: number | null
          costo_total: number | null
          espacios: number | null
          id: number | null
          minutos_armado: number | null
          nombre: string | null
          precio_base: number | null
        }
        Relationships: []
      }
      v_costo_extra: {
        Row: {
          costo_mano_obra: number | null
          costo_materiales: number | null
          costo_total: number | null
          id: number | null
          minutos_armado: number | null
          nombre: string | null
          precio: number | null
        }
        Insert: {
          costo_mano_obra?: never
          costo_materiales?: never
          costo_total?: never
          id?: number | null
          minutos_armado?: never
          nombre?: string | null
          precio?: number | null
        }
        Update: {
          costo_mano_obra?: never
          costo_materiales?: never
          costo_total?: never
          id?: number | null
          minutos_armado?: never
          nombre?: string | null
          precio?: number | null
        }
        Relationships: []
      }
      v_costo_producto: {
        Row: {
          codigo: string | null
          costo_envoltorio: number | null
          costo_flores: number | null
          costo_insumos_propios: number | null
          costo_mano_obra: number | null
          costo_total: number | null
          estado: Database["public"]["Enums"]["estado_publicacion"] | null
          id: number | null
          nombre: string | null
          precio: number | null
        }
        Relationships: []
      }
      v_cotizacion: {
        Row: {
          codigo: string | null
          costo_extras: number | null
          costo_hora: number | null
          costo_mano_obra: number | null
          costo_materiales: number | null
          costo_otros: number | null
          costo_total: number | null
          creado_por: string | null
          created_at: string | null
          descripcion: string | null
          extras: number | null
          ganancia: number | null
          id: number | null
          margen_pct: number | null
          materiales: number | null
          minutos: number | null
          nombre: string | null
          otros_monto: number | null
          otros_pct: number | null
          precio: number | null
          precio_final: number | null
          precio_sugerido: number | null
          producto_id: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_costo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_margen_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_producto_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      v_existencia_extra: {
        Row: {
          bajo_minimo: boolean | null
          estado: Database["public"]["Enums"]["estado_publicacion"] | null
          existencia: number | null
          id: number | null
          nombre: string | null
          precio: number | null
          stock_minimo: number | null
        }
        Relationships: []
      }
      v_existencia_insumo: {
        Row: {
          activo: boolean | null
          bajo_minimo: boolean | null
          costo_unitario: number | null
          existencia: number | null
          id: number | null
          nombre: string | null
          stock_minimo: number | null
          unidad: Database["public"]["Enums"]["unidad_medida"] | null
          valorizado: number | null
        }
        Relationships: []
      }
      v_existencia_producto: {
        Row: {
          bajo_minimo: boolean | null
          codigo: string | null
          estado: Database["public"]["Enums"]["estado_publicacion"] | null
          existencia: number | null
          id: number | null
          nombre: string | null
          precio: number | null
          stock_minimo: number | null
        }
        Relationships: []
      }
      v_kardex: {
        Row: {
          cantidad: number | null
          compra: string | null
          costo_unitario: number | null
          created_at: string | null
          id: number | null
          item: string | null
          item_id: number | null
          nota: string | null
          pedido: string | null
          perfil_id: string | null
          referencia: string | null
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"] | null
          tipo_item: Database["public"]["Enums"]["tipo_item_inventario"] | null
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_inventario_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "v_usuario_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      v_margen_producto: {
        Row: {
          a_perdida: boolean | null
          codigo: string | null
          costo_total: number | null
          estado: Database["public"]["Enums"]["estado_publicacion"] | null
          id: number | null
          margen: number | null
          margen_pct: number | null
          nombre: string | null
          precio: number | null
          precio_sugerido: number | null
        }
        Relationships: []
      }
      v_pedido_saldo: {
        Row: {
          codigo: string | null
          estado: Database["public"]["Enums"]["estado_pedido"] | null
          estado_pago: string | null
          id: number | null
          pagado: number | null
          saldo: number | null
          total_cobrar: number | null
        }
        Insert: {
          codigo?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"] | null
          estado_pago?: never
          id?: number | null
          pagado?: never
          saldo?: never
          total_cobrar?: never
        }
        Update: {
          codigo?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"] | null
          estado_pago?: never
          id?: number | null
          pagado?: never
          saldo?: never
          total_cobrar?: never
        }
        Relationships: []
      }
      v_producto_admin: {
        Row: {
          a_perdida: boolean | null
          categoria: string | null
          categoria_id: number | null
          codigo: string | null
          costo_total: number | null
          created_at: string | null
          descripcion: string | null
          destacado: boolean | null
          envoltorio: string | null
          envoltorio_id: number | null
          espacios_capacidad: number | null
          estado: Database["public"]["Enums"]["estado_publicacion"] | null
          existencia: number | null
          extras_en_receta: number | null
          fotos: number | null
          id: number | null
          imagen_principal: string | null
          lead_time_dias: number | null
          margen: number | null
          margen_pct: number | null
          minutos_armado: number | null
          nombre: string | null
          orden: number | null
          precio: number | null
          precio_desde: boolean | null
          precio_sugerido: number | null
          slug: string | null
          stock_minimo: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producto_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "producto_envoltorio_id_fkey"
            columns: ["envoltorio_id"]
            isOneToOne: false
            referencedRelation: "envoltorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_envoltorio_id_fkey"
            columns: ["envoltorio_id"]
            isOneToOne: false
            referencedRelation: "v_costo_envoltorio"
            referencedColumns: ["id"]
          },
        ]
      }
      v_reporte_compras_mes: {
        Row: {
          compras: number | null
          mes: string | null
          proveedor: string | null
          proveedor_id: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      v_reporte_consumo_insumo: {
        Row: {
          consumido: number | null
          costo_consumido: number | null
          ingresado: number | null
          insumo_id: number | null
          nombre: string | null
          unidad: Database["public"]["Enums"]["unidad_medida"] | null
        }
        Relationships: []
      }
      v_reporte_extra_vendido: {
        Row: {
          extra_id: number | null
          nombre: string | null
          unidades: number | null
          unidades_en_ramos: number | null
          unidades_sueltas: number | null
          vendido: number | null
        }
        Relationships: []
      }
      v_reporte_producto_vendido: {
        Row: {
          pedidos: number | null
          producto: string | null
          producto_id: number | null
          ultima_venta: string | null
          unidades: number | null
          vendido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_costo_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_existencia_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_margen_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_producto_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      v_reporte_ventas_dia: {
        Row: {
          canal: string | null
          cancelados: number | null
          descuentos: number | null
          dia: string | null
          entregados: number | null
          pedidos: number | null
          subtotal: number | null
          total: number | null
        }
        Relationships: []
      }
      v_reporte_ventas_mes: {
        Row: {
          canal: string | null
          mes: string | null
          pedidos: number | null
          ticket_promedio: number | null
          total: number | null
        }
        Relationships: []
      }
      v_rol_admin: {
        Row: {
          activo: boolean | null
          descripcion: string | null
          es_sistema: boolean | null
          id: number | null
          nombre: string | null
          permisos: number | null
          slug: string | null
          usuarios: number | null
        }
        Insert: {
          activo?: boolean | null
          descripcion?: string | null
          es_sistema?: boolean | null
          id?: number | null
          nombre?: string | null
          permisos?: never
          slug?: string | null
          usuarios?: never
        }
        Update: {
          activo?: boolean | null
          descripcion?: string | null
          es_sistema?: boolean | null
          id?: number | null
          nombre?: string | null
          permisos?: never
          slug?: string | null
          usuarios?: never
        }
        Relationships: []
      }
      v_rol_permiso: {
        Row: {
          asignado: boolean | null
          codigo: string | null
          descripcion: string | null
          es_sistema: boolean | null
          modulo: string | null
          permiso_id: number | null
          rol: string | null
          rol_id: number | null
          rol_slug: string | null
        }
        Relationships: []
      }
      v_stock_bajo: {
        Row: {
          existencia: number | null
          id: number | null
          nombre: string | null
          stock_minimo: number | null
          tipo_item: Database["public"]["Enums"]["tipo_item_inventario"] | null
        }
        Relationships: []
      }
      v_tablero_admin: {
        Row: {
          alertas_stock: number | null
          pedidos_en_curso: number | null
          pedidos_por_atender: number | null
          por_cobrar: number | null
          productos_a_perdida: number | null
          vendido_hoy: number | null
          vendido_mes: number | null
        }
        Relationships: []
      }
      v_usuario_admin: {
        Row: {
          activo: boolean | null
          confirmado: boolean | null
          created_at: string | null
          email: string | null
          es_admin: boolean | null
          id: string | null
          nombre: string | null
          permisos: number | null
          roles: string[] | null
          telefono: string | null
          ultimo_acceso: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      anular_compra: {
        Args: { p_compra_id: number; p_motivo: string }
        Returns: Json
      }
      anular_gasto: {
        Args: { p_gasto_id: number; p_motivo: string }
        Returns: Json
      }
      asignar_rol: {
        Args: { p_email: string; p_rol_slug: string }
        Returns: string
      }
      borrar_cotizacion: { Args: { p_id: number }; Returns: undefined }
      cambiar_estado_pedido: {
        Args: {
          p_estado: Database["public"]["Enums"]["estado_pedido"]
          p_nota?: string
          p_pedido_id: number
        }
        Returns: Json
      }
      cantidad_admins: { Args: never; Returns: number }
      convertir_cotizacion_en_producto: {
        Args: { p_categoria_id: number; p_id: number }
        Returns: Json
      }
      costear_configuracion: {
        Args: { p_envoltorio_id: number; p_extras?: Json }
        Returns: Json
      }
      crear_pedido: {
        Args: {
          p_cliente: Json
          p_entrega?: Json
          p_items: Json
          p_nota?: string
        }
        Returns: Json
      }
      crear_venta_mostrador: {
        Args: { p_cliente: Json; p_items: Json; p_nota?: string }
        Returns: Json
      }
      definir_permisos_rol: {
        Args: { p_codigos: string[]; p_rol_id: number }
        Returns: Json
      }
      es_admin: { Args: never; Returns: boolean }
      es_superadmin: { Args: never; Returns: boolean }
      estados_venta_confirmada: {
        Args: never
        Returns: Database["public"]["Enums"]["estado_pedido"][]
      }
      exigir_permiso: { Args: { p_codigo: string }; Returns: undefined }
      exigir_permiso_pedido: {
        Args: { p_accion: string; p_pedido_id: number }
        Returns: undefined
      }
      generar_codigo_producto: {
        Args: { p_envoltorio_id: number }
        Returns: string
      }
      guardar_cotizacion: { Args: { p: Json }; Returns: Json }
      marcar_pedido_enviado_whatsapp: {
        Args: { p_codigo: string }
        Returns: undefined
      }
      mis_permisos: {
        Args: never
        Returns: {
          codigo: string
          modulo: string
        }[]
      }
      normalizar_telefono: { Args: { p_tel: string }; Returns: string }
      parametro_valor: {
        Args: { p_clave: string; p_default?: number }
        Returns: number
      }
      perfil_es_superadmin: { Args: { p_perfil: string }; Returns: boolean }
      permiso_de_pedido: {
        Args: { p_accion: string; p_canal: string }
        Returns: string
      }
      producir_extra: {
        Args: { p_cantidad: number; p_extra_id: number }
        Returns: Json
      }
      programar_pedido: {
        Args: { p_fecha: string; p_pedido_id: number }
        Returns: Json
      }
      puede_pedido: {
        Args: { p_accion: string; p_pedido_id: number }
        Returns: boolean
      }
      puede_ver_perfil: { Args: { p_perfil: string }; Returns: boolean }
      puede_ver_rol: { Args: { p_rol: number }; Returns: boolean }
      rango_fechas: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          desde: string
          hasta: string
        }[]
      }
      recalcular_compra: { Args: { p_compra_id: number }; Returns: undefined }
      recalcular_pedido: { Args: { p_pedido_id: number }; Returns: Json }
      recibir_compra: { Args: { p_compra_id: number }; Returns: Json }
      redondear_a_5: { Args: { p_monto: number }; Returns: number }
      registrar_movimiento: {
        Args: {
          p_cantidad: number
          p_costo?: number
          p_item_id: number
          p_nota?: string
          p_referencia?: string
          p_tipo: Database["public"]["Enums"]["tipo_movimiento"]
          p_tipo_item: Database["public"]["Enums"]["tipo_item_inventario"]
        }
        Returns: number
      }
      registrar_pago: {
        Args: {
          p_metodo?: Database["public"]["Enums"]["metodo_pago"]
          p_monto: number
          p_nota?: string
          p_pedido_id: number
          p_referencia?: string
        }
        Returns: Json
      }
      registrar_salida_pedido: { Args: { p_pedido_id: number }; Returns: Json }
      reporte_bitacora: {
        Args: {
          p_desde: string
          p_entidad?: string
          p_hasta: string
          p_perfil?: string
          p_sistema?: boolean
        }
        Returns: Json
      }
      reporte_compras: {
        Args: { p_desde: string; p_hasta: string }
        Returns: Json
      }
      reporte_ganancias: {
        Args: { p_desde: string; p_hasta: string }
        Returns: Json
      }
      reporte_ventas: {
        Args: { p_desde: string; p_hasta: string }
        Returns: Json
      }
      reporte_ventas_confirmadas: {
        Args: { p_desde: string; p_hasta: string }
        Returns: Json
      }
      rol_es_superadmin: { Args: { p_rol: number }; Returns: boolean }
      sincronizar_permisos_admin: { Args: never; Returns: number }
      slugify: { Args: { p_texto: string }; Returns: string }
      telefono_sin_cliente: { Args: never; Returns: string }
      tiene_permiso: { Args: { p_codigo: string }; Returns: boolean }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      estado_compra: "borrador" | "recibida" | "anulada"
      estado_gasto: "registrado" | "anulado"
      estado_pedido:
        | "nuevo"
        | "enviado_whatsapp"
        | "confirmado"
        | "en_produccion"
        | "listo"
        | "entregado"
        | "cancelado"
      estado_publicacion:
        | "borrador"
        | "activo"
        | "agotado"
        | "temporada"
        | "inactivo"
      metodo_pago: "efectivo" | "qr" | "transferencia" | "tarjeta" | "otro"
      tipo_entrega: "recojo_tienda" | "envio"
      tipo_item_inventario: "insumo" | "extra" | "producto"
      tipo_item_pedido: "producto" | "extra" | "personalizado"
      tipo_movimiento:
        | "compra"
        | "produccion"
        | "consumo"
        | "venta"
        | "ajuste"
        | "merma"
        | "devolucion"
      unidad_medida:
        | "unidad"
        | "par"
        | "paquete"
        | "pliego"
        | "rollo"
        | "metro"
        | "centimetro"
        | "gramo"
        | "kilogramo"
        | "litro"
        | "mililitro"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_compra: ["borrador", "recibida", "anulada"],
      estado_gasto: ["registrado", "anulado"],
      estado_pedido: [
        "nuevo",
        "enviado_whatsapp",
        "confirmado",
        "en_produccion",
        "listo",
        "entregado",
        "cancelado",
      ],
      estado_publicacion: [
        "borrador",
        "activo",
        "agotado",
        "temporada",
        "inactivo",
      ],
      metodo_pago: ["efectivo", "qr", "transferencia", "tarjeta", "otro"],
      tipo_entrega: ["recojo_tienda", "envio"],
      tipo_item_inventario: ["insumo", "extra", "producto"],
      tipo_item_pedido: ["producto", "extra", "personalizado"],
      tipo_movimiento: [
        "compra",
        "produccion",
        "consumo",
        "venta",
        "ajuste",
        "merma",
        "devolucion",
      ],
      unidad_medida: [
        "unidad",
        "par",
        "paquete",
        "pliego",
        "rollo",
        "metro",
        "centimetro",
        "gramo",
        "kilogramo",
        "litro",
        "mililitro",
      ],
    },
  },
} as const
