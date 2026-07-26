CREATE OR REPLACE FUNCTION checkout_sale_transaction(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_customer_id UUID;
    v_session_id UUID;
    v_gross_total NUMERIC;
    v_discount_total NUMERIC;
    v_net_total NUMERIC;
    v_payment_method TEXT;
    v_notes TEXT;
    v_sale_id UUID;
    v_item JSONB;
    v_payment JSONB;
    v_product_id UUID;
    v_quantity NUMERIC;
BEGIN
    -- 1. Extract values from JSON payload safely
    v_tenant_id := (p_payload->>'tenant_id')::UUID;
    v_user_id := (p_payload->>'user_id')::UUID;
    
    IF p_payload->>'customer_id' IS NOT NULL AND p_payload->>'customer_id' != '' THEN
        v_customer_id := (p_payload->>'customer_id')::UUID;
    END IF;
    
    IF p_payload->>'session_id' IS NOT NULL AND p_payload->>'session_id' != '' THEN
        v_session_id := (p_payload->>'session_id')::UUID;
    END IF;

    v_gross_total := (p_payload->>'gross_total')::NUMERIC;
    v_discount_total := (p_payload->>'discount_total')::NUMERIC;
    v_net_total := (p_payload->>'net_total')::NUMERIC;
    v_payment_method := p_payload->>'payment_method';
    v_notes := p_payload->>'notes';

    -- 2. Insert into sales
    INSERT INTO sales (
        tenant_id, 
        user_id, 
        customer_id, 
        session_id, 
        gross_total, 
        discount_total, 
        net_total, 
        payment_method, 
        notes
    ) VALUES (
        v_tenant_id,
        v_user_id,
        v_customer_id,
        v_session_id,
        v_gross_total,
        v_discount_total,
        v_net_total,
        v_payment_method,
        v_notes
    ) RETURNING id INTO v_sale_id;

    -- 3. Insert items and update stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;

        INSERT INTO sale_items (
            sale_id,
            product_id,
            quantity,
            unit_price,
            discount,
            total
        ) VALUES (
            v_sale_id,
            v_product_id,
            v_quantity,
            (v_item->>'unit_price')::NUMERIC,
            (v_item->>'discount')::NUMERIC,
            (v_item->>'total')::NUMERIC
        );

        -- Decrement stock (reusing existing RPC)
        PERFORM decrement_stock(p_product_id := v_product_id, p_quantity := v_quantity);

        -- Insert stock movement
        INSERT INTO stock_movements (
            tenant_id,
            product_id,
            movement_type,
            quantity,
            description,
            sale_id
        ) VALUES (
            v_tenant_id,
            v_product_id,
            'sale',
            -v_quantity,
            'Venda #' || substring(v_sale_id::text from 1 for 8),
            v_sale_id
        );

        -- FEFO consume lots (Ignora se o produto não tem lote)
        BEGIN
            PERFORM consume_lots_fefo(
                _tenant_id := v_tenant_id,
                _product_id := v_product_id,
                _quantity := v_quantity
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;

    -- 4. Insert payments
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payload->'payments')
    LOOP
        INSERT INTO sale_payments (
            sale_id,
            payment_method_id,
            payment_method_code,
            amount,
            change_amount,
            installments,
            authorization_code
        ) VALUES (
            v_sale_id,
            NULLIF(v_payment->>'payment_method_id', '')::UUID,
            v_payment->>'payment_method_code',
            (v_payment->>'amount')::NUMERIC,
            COALESCE((v_payment->>'change_amount')::NUMERIC, 0),
            COALESCE((v_payment->>'installments')::INTEGER, 1),
            v_payment->>'authorization_code'
        );

        -- Cash movements for each payment if session exists
        IF v_session_id IS NOT NULL THEN
            INSERT INTO cash_movements (
                tenant_id,
                session_id,
                movement_type,
                payment_method,
                amount,
                description,
                sale_id,
                user_id
            ) VALUES (
                v_tenant_id,
                v_session_id,
                'sale',
                v_payment->>'payment_method_code',
                (v_payment->>'amount')::NUMERIC,
                'Venda #' || substring(v_sale_id::text from 1 for 8),
                v_sale_id,
                v_user_id
            );
        END IF;
    END LOOP;

    -- 5. Create financial entry
    INSERT INTO financial_entries (
        tenant_id,
        type,
        description,
        amount,
        payment_method,
        sale_id
    ) VALUES (
        v_tenant_id,
        'income',
        'Venda #' || substring(v_sale_id::text from 1 for 8),
        v_net_total,
        v_payment_method,
        v_sale_id
    );

    -- 6. Credit loyalty points
    IF v_customer_id IS NOT NULL THEN
        BEGIN
            PERFORM credit_loyalty_points(
                p_tenant_id := v_tenant_id,
                p_customer_id := v_customer_id,
                p_sale_id := v_sale_id,
                p_sale_amount := v_net_total
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- 7. Return success payload
    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Re-raise to trigger rollback
        RAISE EXCEPTION 'Erro ao finalizar venda: %', SQLERRM;
END;
$$;
