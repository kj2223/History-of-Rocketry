// Soft unlit pieces: blob shadows under the pixel people, light shafts, dust.
Shader "AdAstra/UnlitAlpha"
{
    Properties { _MainTex ("Tex", 2D) = "white" {} _Color ("Color", Color) = (0, 0, 0, 0.4) }
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "IgnoreProjector" = "True" }
        Blend SrcAlpha OneMinusSrcAlpha ZWrite Off Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex; float4 _Color;
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
            v2f vert (appdata_base v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.texcoord.xy; return o; }
            float4 frag (v2f i) : SV_Target { return tex2D(_MainTex, i.uv) * _Color; }
            ENDCG
        }
    }
}
