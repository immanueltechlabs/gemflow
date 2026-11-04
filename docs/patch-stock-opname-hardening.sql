-- REVIEW-ONLY incremental patch. Do not execute until the live schema and
-- deployed function definitions have been verified and this patch approved.
-- Assumes the stock_opnames, stock_opname_items, and stock_opname_scans tables
-- and the existing scan_stock_opname(uuid, text) contract are already present.

CREATE OR REPLACE FUNCTION public.cancel_stock_opname(p_stock_opname_id uuid)
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
  IF p_stock_opname_id IS NULL THEN
    RAISE EXCEPTION 'Stock opname session ID is required';
  END IF;

  SELECT *
    INTO v_opname
    FROM public.stock_opnames
   WHERE id = p_stock_opname_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock opname session not found';
  END IF;
  IF v_opname.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Stock opname session is not in progress';
  END IF;
  IF v_opname.started_by <> v_user_id AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Only the session creator or an Admin can cancel this opname'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.stock_opnames
     SET status = 'cancelled',
         completed_by = v_user_id,
         completed_at = now()
   WHERE id = p_stock_opname_id;
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
    v_result := 'unexpected';
    UPDATE public.stock_opnames
       SET unexpected_count = unexpected_count + 1
     WHERE id = p_stock_opname_id;

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

REVOKE ALL ON FUNCTION public.cancel_stock_opname(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_opname(uuid) TO authenticated;
