-- PROPOSAL ONLY. Do not execute until the schema, RLS, and function contracts
-- have been reviewed and explicitly approved.
--
-- Assumptions from the application:
-- public.products.id is uuid; sku is text; barcode is text; status is text;
-- image_path is nullable text; public.profiles has id, role, and is_active.

CREATE TABLE public.stock_opnames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  expected_count integer NOT NULL DEFAULT 0 CHECK (expected_count >= 0),
  matched_count integer NOT NULL DEFAULT 0 CHECK (matched_count >= 0),
  missing_count integer NOT NULL DEFAULT 0 CHECK (missing_count >= 0),
  unexpected_count integer NOT NULL DEFAULT 0 CHECK (unexpected_count >= 0),
  duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  unknown_count integer NOT NULL DEFAULT 0 CHECK (unknown_count >= 0),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (matched_count <= expected_count),
  CHECK (missing_count <= expected_count)
);

-- One immutable expected-product snapshot row per product and session.
CREATE TABLE public.stock_opname_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_opname_id uuid NOT NULL
    REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  barcode text,
  sku text NOT NULL,
  product_name text NOT NULL,
  image_path text,
  scanned boolean NOT NULL DEFAULT false,
  scan_count integer NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
  scanned_at timestamptz,
  scanned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stock_opname_id, product_id),
  CHECK ((scanned AND scan_count >= 1 AND scanned_at IS NOT NULL)
      OR (NOT scanned AND scan_count = 0 AND scanned_at IS NULL))
);

-- Append-only scan history. Product labels are copied so completed results
-- remain readable if a product is later edited or removed.
CREATE TABLE public.stock_opname_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_opname_id uuid NOT NULL
    REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  product_id uuid,
  scanned_code text NOT NULL,
  barcode text,
  sku text,
  product_name text,
  image_path text,
  result text NOT NULL CHECK (result IN ('matched', 'duplicate', 'unexpected', 'unknown')),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stock_opnames_history_idx
  ON public.stock_opnames (started_at DESC, id DESC);
CREATE UNIQUE INDEX stock_opnames_one_active_idx
  ON public.stock_opnames ((1))
  WHERE status = 'in_progress';
CREATE INDEX stock_opname_items_section_idx
  ON public.stock_opname_items (stock_opname_id, scanned, product_name, id);
CREATE INDEX stock_opname_items_barcode_idx
  ON public.stock_opname_items (stock_opname_id, barcode)
  WHERE barcode IS NOT NULL;
CREATE INDEX stock_opname_items_sku_idx
  ON public.stock_opname_items (stock_opname_id, sku);
CREATE INDEX stock_opname_scans_recent_idx
  ON public.stock_opname_scans (stock_opname_id, scanned_at DESC, id DESC);
CREATE INDEX stock_opname_scans_results_idx
  ON public.stock_opname_scans (stock_opname_id, result, scanned_at DESC, id DESC);
CREATE INDEX stock_opname_scans_product_idx
  ON public.stock_opname_scans (stock_opname_id, product_id)
  WHERE product_id IS NOT NULL;

ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_scans ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stock_opnames FROM anon, authenticated;
REVOKE ALL ON TABLE public.stock_opname_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.stock_opname_scans FROM anon, authenticated;
GRANT SELECT ON TABLE public.stock_opnames TO authenticated;
GRANT SELECT ON TABLE public.stock_opname_items TO authenticated;
GRANT SELECT ON TABLE public.stock_opname_scans TO authenticated;

DROP POLICY IF EXISTS stock_opnames_select_active_staff ON public.stock_opnames;
CREATE POLICY stock_opnames_select_active_staff
  ON public.stock_opnames
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
        AND profile.is_active IS TRUE
        AND profile.role IN ('admin', 'cashier')
        AND (
          profile.role = 'admin'
          OR stock_opnames.status <> 'in_progress'
          OR stock_opnames.started_by = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS stock_opname_items_select_active_staff ON public.stock_opname_items;
CREATE POLICY stock_opname_items_select_active_staff
  ON public.stock_opname_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stock_opnames AS opname
      JOIN public.profiles AS profile
        ON profile.id = (SELECT auth.uid())
      WHERE opname.id = stock_opname_items.stock_opname_id
        AND profile.is_active IS TRUE
        AND profile.role IN ('admin', 'cashier')
        AND (
          profile.role = 'admin'
          OR opname.status <> 'in_progress'
          OR opname.started_by = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS stock_opname_scans_select_active_staff ON public.stock_opname_scans;
CREATE POLICY stock_opname_scans_select_active_staff
  ON public.stock_opname_scans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stock_opnames AS opname
      JOIN public.profiles AS profile
        ON profile.id = (SELECT auth.uid())
      WHERE opname.id = stock_opname_scans.stock_opname_id
        AND profile.is_active IS TRUE
        AND profile.role IN ('admin', 'cashier')
        AND (
          profile.role = 'admin'
          OR opname.status <> 'in_progress'
          OR opname.started_by = (SELECT auth.uid())
        )
    )
  );

CREATE OR REPLACE FUNCTION public.start_stock_opname(p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_opname_id uuid;
  v_expected_count integer;
BEGIN
  SELECT profile.role
    INTO v_role
    FROM public.profiles AS profile
   WHERE profile.id = v_user_id
     AND profile.is_active IS TRUE;

  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION 'Active Admin or Cashier access required'
      USING ERRCODE = '42501';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 1000 THEN
    RAISE EXCEPTION 'Notes are limited to 1000 characters';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_opnames AS opname
    WHERE opname.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Masih ada Stock Opname yang sedang berjalan';
  END IF;

  BEGIN
    INSERT INTO public.stock_opnames (started_by, status, notes)
    VALUES (v_user_id, 'in_progress', NULLIF(btrim(p_notes), ''))
    RETURNING id INTO v_opname_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Masih ada Stock Opname yang sedang berjalan';
  END;

  INSERT INTO public.stock_opname_items (
    stock_opname_id, product_id, barcode, sku, product_name, image_path
  )
  SELECT
    v_opname_id, product.id, product.barcode, product.sku, product.name, product.image_path
  FROM public.products AS product
  WHERE product.status = 'available';
  GET DIAGNOSTICS v_expected_count = ROW_COUNT;

  UPDATE public.stock_opnames
     SET expected_count = v_expected_count,
         missing_count = v_expected_count
   WHERE id = v_opname_id;

  RETURN v_opname_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.scan_stock_opname(
  p_stock_opname_id uuid,
  p_identifier text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_opname public.stock_opnames%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_item public.stock_opname_items%ROWTYPE;
  v_scan public.stock_opname_scans%ROWTYPE;
  v_identifier text := btrim(p_identifier);
  v_result text;
  v_is_expected boolean := FALSE;
  v_has_product boolean := FALSE;
BEGIN
  SELECT profile.role
    INTO v_role
    FROM public.profiles AS profile
   WHERE profile.id = v_user_id
     AND profile.is_active IS TRUE;
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION 'Active Admin or Cashier access required'
      USING ERRCODE = '42501';
  END IF;
  IF p_stock_opname_id IS NULL OR v_identifier IS NULL OR v_identifier = ''
      OR length(v_identifier) > 100 THEN
    RAISE EXCEPTION 'Invalid stock opname scan input';
  END IF;

  SELECT *
    INTO v_opname
    FROM public.stock_opnames
   WHERE id = p_stock_opname_id
   FOR UPDATE;
  IF NOT FOUND OR v_opname.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Stock opname session is not in progress';
  END IF;
  IF v_opname.started_by <> v_user_id THEN
    RAISE EXCEPTION 'Only the session creator can record scans'
      USING ERRCODE = '42501';
  END IF;

  -- Snapshot identifiers take precedence so product edits during the count
  -- cannot turn an expected snapshot item into an unknown scan.
  SELECT *
    INTO v_item
    FROM public.stock_opname_items
   WHERE stock_opname_id = p_stock_opname_id
     AND barcode = v_identifier
   ORDER BY product_id
   LIMIT 1
   FOR UPDATE;
  v_is_expected := FOUND;

  IF NOT v_is_expected THEN
    SELECT *
      INTO v_product
      FROM public.products
     WHERE barcode = v_identifier
     ORDER BY id
     LIMIT 1;
    v_has_product := FOUND;
    IF v_has_product THEN
      SELECT *
        INTO v_item
        FROM public.stock_opname_items
       WHERE stock_opname_id = p_stock_opname_id
         AND product_id = v_product.id
       FOR UPDATE;
      v_is_expected := FOUND;
    END IF;
  END IF;

  IF NOT v_is_expected AND NOT v_has_product THEN
    SELECT *
      INTO v_item
      FROM public.stock_opname_items
     WHERE stock_opname_id = p_stock_opname_id
       AND sku = v_identifier
     ORDER BY product_id
     LIMIT 1
     FOR UPDATE;
    v_is_expected := FOUND;
  END IF;

  IF NOT v_is_expected AND NOT v_has_product THEN
    SELECT *
      INTO v_product
      FROM public.products
     WHERE sku = v_identifier
     ORDER BY id
     LIMIT 1;
    v_has_product := FOUND;
    IF v_has_product THEN
      SELECT *
        INTO v_item
        FROM public.stock_opname_items
       WHERE stock_opname_id = p_stock_opname_id
         AND product_id = v_product.id
       FOR UPDATE;
      v_is_expected := FOUND;
    END IF;
  END IF;

  IF v_is_expected THEN
    IF v_item.scanned THEN
      v_result := 'duplicate';
      UPDATE public.stock_opname_items
         SET scan_count = scan_count + 1
       WHERE id = v_item.id;
      UPDATE public.stock_opnames
         SET duplicate_count = duplicate_count + 1
       WHERE id = p_stock_opname_id;
    ELSE
      v_result := 'matched';
      UPDATE public.stock_opname_items
         SET scanned = TRUE,
             scan_count = 1,
             scanned_at = now(),
             scanned_by = v_user_id
       WHERE id = v_item.id;
      UPDATE public.stock_opnames
         SET matched_count = matched_count + 1,
             missing_count = GREATEST(expected_count - matched_count - 1, 0)
       WHERE id = p_stock_opname_id;
    END IF;

    INSERT INTO public.stock_opname_scans (
      stock_opname_id, product_id, scanned_code, barcode, sku, product_name,
      image_path, result, scanned_by
    )
    VALUES (
      p_stock_opname_id, v_item.product_id, v_identifier, v_item.barcode, v_item.sku,
      v_item.product_name, v_item.image_path, v_result, v_user_id
    )
    RETURNING * INTO v_scan;
  ELSIF v_has_product THEN
    IF EXISTS (
      SELECT 1
      FROM public.stock_opname_scans AS previous_scan
      WHERE previous_scan.stock_opname_id = p_stock_opname_id
        AND previous_scan.product_id = v_product.id
    ) THEN
      v_result := 'duplicate';
      UPDATE public.stock_opnames
         SET duplicate_count = duplicate_count + 1
       WHERE id = p_stock_opname_id;
    ELSE
      v_result := 'unexpected';
      UPDATE public.stock_opnames
         SET unexpected_count = unexpected_count + 1
       WHERE id = p_stock_opname_id;
    END IF;

    INSERT INTO public.stock_opname_scans (
      stock_opname_id, product_id, scanned_code, barcode, sku, product_name,
      image_path, result, scanned_by
    )
    VALUES (
      p_stock_opname_id, v_product.id, v_identifier, v_product.barcode,
      v_product.sku, v_product.name, v_product.image_path, v_result, v_user_id
    )
    RETURNING * INTO v_scan;
  ELSE
    UPDATE public.stock_opnames
       SET unknown_count = unknown_count + 1
     WHERE id = p_stock_opname_id;

    INSERT INTO public.stock_opname_scans (
      stock_opname_id, product_id, scanned_code, result, scanned_by
    )
    VALUES (p_stock_opname_id, NULL, v_identifier, 'unknown', v_user_id)
    RETURNING * INTO v_scan;
  END IF;

  RETURN to_jsonb(v_scan);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_stock_opname(p_stock_opname_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_opname public.stock_opnames%ROWTYPE;
BEGIN
  SELECT profile.role
    INTO v_role
    FROM public.profiles AS profile
   WHERE profile.id = v_user_id
     AND profile.is_active IS TRUE;
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION 'Active Admin or Cashier access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_opname
    FROM public.stock_opnames
   WHERE id = p_stock_opname_id
   FOR UPDATE;
  IF NOT FOUND OR v_opname.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Stock opname session is not in progress';
  END IF;
  IF v_opname.started_by <> v_user_id THEN
    RAISE EXCEPTION 'Only the session creator can complete this opname'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.stock_opnames
     SET status = 'completed',
         completed_by = v_user_id,
         completed_at = now(),
         missing_count = GREATEST(expected_count - matched_count, 0)
   WHERE id = p_stock_opname_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.start_stock_opname(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scan_stock_opname(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_stock_opname(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_stock_opname(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scan_stock_opname(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_stock_opname(uuid) TO authenticated;

-- Optional lookup indexes: check pg_indexes first because unique barcode/SKU
-- constraints may already provide equivalent indexes.
-- CREATE INDEX products_barcode_stock_opname_idx ON public.products (barcode) WHERE barcode IS NOT NULL;
-- CREATE INDEX products_sku_stock_opname_idx ON public.products (sku);
