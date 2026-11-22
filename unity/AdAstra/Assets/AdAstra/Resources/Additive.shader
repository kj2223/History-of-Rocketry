// Flame and glows: a colour added on top, brightest in the middle of the mesh's V coordinate.
Shader "AdAstra/Additive"
{
    Properties { _Color ("Color", Color) = (1, 0.7, 0.3, 1) }
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" }
        Blend One One ZWrite Off Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            float4 _Color;
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
            v2f vert (appdata_base v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.texcoord.xy; return o; }
            float4 frag (v2f i) : SV_Target { float a = saturate(1 - i.uv.y) ; return float4(_Color.rgb * a * _Color.a, 1); }
            ENDCG
        }
    }
}
