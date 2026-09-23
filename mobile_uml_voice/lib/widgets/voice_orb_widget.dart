import 'package:flutter/material.dart';

class VoiceOrbWidget extends StatefulWidget {
  final bool isListening;
  final VoidCallback onTap;

  const VoiceOrbWidget({
    Key? key,
    required this.isListening,
    required this.onTap,
  }) : super(key: key);

  @override
  State<VoiceOrbWidget> createState() => _VoiceOrbWidgetState();
}

class _VoiceOrbWidgetState extends State<VoiceOrbWidget> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _scaleAnimation = Tween<double>(begin: 0.92, end: 1.12).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          final scale = widget.isListening ? _scaleAnimation.value : 1.0;
          return Transform.scale(
            scale: scale,
            child: Container(
              width: 170,
              height: 170,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: widget.isListening
                      ? [
                          const Color(0xFFF43F5E),
                          const Color(0xFFA855F7),
                          const Color(0xFF3B82F6).withOpacity(0.2),
                          Colors.transparent,
                        ]
                      : [
                          const Color(0xFFA855F7),
                          const Color(0xFF06B6D4),
                          const Color(0xFF10B981).withOpacity(0.2),
                          Colors.transparent,
                        ],
                  stops: const [0.2, 0.55, 0.85, 1.0],
                ),
                boxShadow: [
                  BoxShadow(
                    color: (widget.isListening ? const Color(0xFFF43F5E) : const Color(0xFFA855F7)).withOpacity(0.4),
                    blurRadius: widget.isListening ? 45 : 30,
                    spreadRadius: widget.isListening ? 8 : 2,
                  ),
                ],
              ),
              child: Center(
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFF0F172A),
                    border: Border.all(
                      color: widget.isListening ? const Color(0xFFFB7185) : const Color(0xFFC084FC),
                      width: 2.5,
                    ),
                  ),
                  child: Icon(
                    widget.isListening ? Icons.mic : Icons.mic_none,
                    color: widget.isListening ? const Color(0xFFFDA4AF) : Colors.white,
                    size: 42,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
